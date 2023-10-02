import util from 'util';
import Web3Utils from 'web3-utils';
import { setTimeout } from 'timers';

import { getRootLogger } from '@backstage/backend-common';
import axios from 'axios';
import retry from 'async-retry';
import { ethers } from 'ethers';
import type { Networkish } from '@ethersproject/providers';
import { EtherscanTx } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { networksByName } from './networks';

const etherscanCommentHeader = `/**
 *Submitted for verification at Etherscan.io on 20XX-XX-XX
*/
`; // note we include that final newline

function makeFilename(name: string, extension: string = '.sol'): string {
  if (!name) {
    return `Contract${extension}`;
  }
  if (name.endsWith(extension)) {
    return name;
  }
  return name + extension;
}

const makeTimer: (milliseconds: number) => Promise<void> =
  util.promisify(setTimeout);

function removeLibraries(
  settings: SolcSettings,
  alsoRemoveCompilationTarget: boolean = false,
): SolcSettings {
  const copySettings: SolcSettings = { ...settings };
  delete copySettings.libraries;
  if (alsoRemoveCompilationTarget) {
    delete copySettings.compilationTarget;
  }
  return copySettings;
}

// this looks awkward but the TS docs actually suggest this :P
export class EtherscanClient {
  static logger = getRootLogger().child({ class: this.constructor.name });
  logger = EtherscanClient.logger;

  private readonly networkName: string;

  private readonly apiKey: string;
  private readonly delay: number; // minimum # of ms to wait between requests

  private ready: Promise<void>; // always await this timer before making a request.
  // then, afterwards, start a new timer.

  public static readonly apiDomainsByNetworkName: { [name: string]: string } = {
    mainnet: 'api.etherscan.io',
    ropsten: 'api-ropsten.etherscan.io',
    kovan: 'api-kovan.etherscan.io',
    rinkeby: 'api-rinkeby.etherscan.io',
    goerli: 'api-goerli.etherscan.io',
    optimistic: 'api-optimistic.etherscan.io',
    'kovan-optimistic': 'api-kovan-optimistic.etherscan.io',
    arbitrum: 'api.arbiscan.io',
    'rinkeby-arbitrum': 'api-testnet.arbiscan.io',
    polygon: 'api.polygonscan.com',
    'mumbai-polygon': 'api-mumbai.polygonscan.com',
    binance: 'api.bscscan.com',
    'testnet-binance': 'api-testnet.bscscan.com',
    fantom: 'api.ftmscan.com',
    'testnet-fantom': 'api-testnet.ftmscan.com',
    avalanche: 'api.snowtrace.io',
    'fuji-avalanche': 'api-testnet.snowtrace.io',
    heco: 'api.hecoinfo.com',
    'testnet-heco': 'api-testnet.hecoinfo.com',
    moonbeam: 'api-moonbeam.moonscan.io',
    moonriver: 'api-moonriver.moonscan.io',
    'moonbase-alpha': 'api-moonbase.moonscan.io',
    hoo: 'api.hooscan.com',
    cronos: 'api.cronoscan.com',
    'testnet-cronos': 'api-testnet.cronoscan.com',
    bttc: 'api.bttcscan.com',
    'donau-bttc': 'api-testnet.bttcscan.com',
    aurora: 'explorer.mainnet.aurora.dev',
    'testnet-aurora': 'explorer.testnet.aurora.dev',
    celo: 'api.celoscan.xyz',
    'alfajores-celo': 'api-alfajores.celoscan.xyz',
    clover: 'api.clvscan.com',
  };

  constructor(networkName: string, apiKey: string = '') {
    if (!(networkName in EtherscanClient.apiDomainsByNetworkName)) {
      throw new Error(`Invalid network ${networkName}`);
    }
    this.networkName = networkName;
    this.logger = this.logger.child({ network: networkName });
    this.apiKey = apiKey;
    const baseDelay = this.apiKey ? 200 : 3000; // etherscan permits 5 requests/sec w/a key, 1/3sec w/o
    const safetyFactor = 1; // no safety factor atm
    this.delay = baseDelay * safetyFactor;
    this.ready = makeTimer(0); // at start, it's ready to go immediately
  }

  async fetchSourcesForAddress(address: string): Promise<SourceInfo | null> {
    const response = await this.fetchWithRetry(address);
    if (response.result[0].Proxy || response.result[0].IsProxy) {
      const implementationAddress =
        response.result[0].Implementation ||
        response.result[0].ImplementationAddress;
      if (implementationAddress) {
        const impResponse = await this.fetchWithRetry(implementationAddress);
        const proxyResult = this.processResult(response.result[0]);
        const impResult = this.processResult(impResponse.result[0]);
        return {
          ...proxyResult,
          sources: {
            ...proxyResult?.sources,
            ...impResult?.sources,
          },
          etherScanResult: impResult?.etherScanResult,
        } as any;
      }
    }
    return this.processResult(response.result[0]);
  }

  async fetchTransactions(
    address: string,
    opts: FetchTransactionsOpts = {
      page: 1,
      offset: 10,
      sort: 'desc',
    },
  ): Promise<EtherscanTxlistResponse> {
    // not putting a try/catch around this; if it throws, we throw
    await this.ready;
    const { page = 1, offset = 10, sort = 'desc' } = opts;
    const responsePromise = axios.get<EtherscanTxlistResponse>(
      this.determineUrl(),
      {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          startblock: opts.startblock,
          endblock: opts.endblock,
          page,
          offset,
          sort,
          ...(this.networkName !== 'aurora' ? { apiKey: this.apiKey } : {}),
        },
        responseType: 'json',
        maxRedirects: 50,
      },
    );
    this.ready = makeTimer(this.delay);
    const response = (await responsePromise).data;
    if (response.status === '0') throw new Error(response.message);

    return response;
  }

  async fetchCreationTransaction(
    address: string,
  ): Promise<EtherscanTxInfoResponse> {
    // not putting a try/catch around this; if it throws, we throw
    await this.ready;
    const creationTxPromise = axios.get<BlockscoutV2AddressResponse>(
      `${this.determineUrl()}/v2/addresses/${address}`,
    );
    this.ready = makeTimer(this.delay);
    const { data: addressData } = await creationTxPromise;

    await this.ready;
    const txInfoPromise = axios.get<EtherscanTxInfoResponse>(
      this.determineUrl(),
      {
        headers: {
          module: 'transaction',
          action: 'gettxinfo',
          txhash: addressData.creation_tx_hash,
        },
        responseType: 'json',
        maxRedirects: 50,
      },
    );
    this.ready = makeTimer(this.delay);
    const { data: txInfo } = await txInfoPromise;
    if (txInfo.message !== 'OK') throw new Error(txInfo.message);

    return txInfo;
  }

  private async fetchWithRetry(address: string): Promise<EtherscanSuccess> {
    const initialTimeoutFactor = 1.5;
    return await retry(async () => await this.makeRequest(address), {
      retries: 3,
      minTimeout: this.delay * initialTimeoutFactor,
    });
  }

  private determineUrl() {
    const domain = EtherscanClient.apiDomainsByNetworkName[this.networkName];
    return `https://${domain}/api`;
  }

  private async makeRequest(address: string): Promise<EtherscanSuccess> {
    // not putting a try/catch around this; if it throws, we throw
    await this.ready;
    const responsePromise = axios.get(this.determineUrl(), {
      params: {
        module: 'contract',
        action: 'getsourcecode',
        address,
        ...(this.networkName !== 'aurora' ? { apiKey: this.apiKey } : {}),
      },
      responseType: 'json',
      maxRedirects: 50,
    });
    this.ready = makeTimer(this.delay);
    const response: EtherscanSuccess | EtherscanFailure = (
      await responsePromise
    ).data;
    if (response.status === '0') throw new Error(response.result);

    return response;
  }

  private processResult(result: EtherscanResult): SourceInfo | null {
    // we have 5 cases here.
    // case 1: the address doesn't exist
    if (
      result.SourceCode === '' &&
      result.ABI === 'Contract source code not verified'
    ) {
      return null;
    }
    // case 2: it's a Vyper contract
    if (result.CompilerVersion.startsWith('vyper:')) {
      return this.processVyperResult(result);
    }
    let multifileJson: SolcSources;
    try {
      // try to parse the source JSON.  if it succeeds,
      // we're in the multi-file case.
      multifileJson = JSON.parse(result.SourceCode);
    } catch (_) {
      // otherwise, we could be single-file or we could be full JSON.
      // for full JSON input, etherscan will stick an extra pair of braces around it
      if (
        result.SourceCode.startsWith('{') &&
        result.SourceCode.endsWith('}')
      ) {
        const trimmedSource = result.SourceCode.slice(1).slice(0, -1); // remove braces
        let fullJson: SolcInput;
        try {
          fullJson = JSON.parse(trimmedSource);
        } catch (__) {
          // if it still doesn't parse, it's single-source I guess?
          // (note: we shouldn't really end up here?)
          this.logger.debug('single-file input??');
          return this.processSingleResult(result);
        }
        // case 5: full JSON input
        this.logger.debug('json input');
        return this.processJsonResult(result, fullJson);
      }
      // case 3 (the way it should happen): single source
      this.logger.debug('single-file input');
      return this.processSingleResult(result);
    }
    // case 4: multiple sources
    this.logger.debug('multi-file input');
    return this.processMultiResult(result, multifileJson);
  }

  private processSingleResult(result: EtherscanResult): SourceInfo {
    const filename = makeFilename(result.ContractName);
    return {
      etherScanResult: result,
      contractName: result.ContractName,
      sources: {
        // we prepend this header comment so that line numbers in the debugger
        // will match up with what's displayed on the website; note that other
        // cases don't display a similar header on the website
        [filename]: etherscanCommentHeader + result.SourceCode,
      },
      options: {
        language: 'Solidity',
        version: result.CompilerVersion,
        settings: this.extractSettings(result),
        specializations: {
          libraries: this.processLibraries(result.Library),
          constructorArguments: result.ConstructorArguments,
        },
      },
    };
  }

  private processMultiResult(
    result: EtherscanResult,
    sources: SolcSources,
  ): SourceInfo {
    return {
      etherScanResult: result,
      contractName: result.ContractName,
      sources: this.processSources(sources),
      options: {
        language: 'Solidity',
        version: result.CompilerVersion,
        settings: this.extractSettings(result),
        specializations: {
          libraries: this.processLibraries(result.Library),
          constructorArguments: result.ConstructorArguments,
        },
      },
    };
  }

  private processJsonResult(
    result: EtherscanResult,
    jsonInput: SolcInput,
  ): SourceInfo {
    return {
      etherScanResult: result,
      contractName: result.ContractName,
      sources: this.processSources(jsonInput.sources),
      options: {
        language: jsonInput.language,
        version: result.CompilerVersion,
        settings: removeLibraries(jsonInput.settings), // we *don't* want to pass library info!  unlinked bytecode is better!
        specializations: {
          libraries: jsonInput.settings.libraries,
          constructorArguments: result.ConstructorArguments,
        },
      },
    };
  }

  private processVyperResult(result: EtherscanResult): SourceInfo {
    const filename = makeFilename(result.ContractName, '.vy');
    // note: this means filename will always be Vyper_contract.vy
    return {
      etherScanResult: result,
      sources: {
        [filename]: result.SourceCode,
      },
      options: {
        language: 'Vyper',
        version: result.CompilerVersion.replace(/^vyper:/, ''),
        settings: this.extractVyperSettings(result),
        specializations: {
          constructorArguments: result.ConstructorArguments,
        },
      },
    };
  }

  private processSources(sources: SolcSources): SourcesByPath {
    return Object.assign(
      {},
      ...Object.entries(sources).map(([path, { content: source }]) => ({
        [makeFilename(path)]: source,
      })),
    );
  }

  private extractSettings(result: EtherscanResult): SolcSettings {
    const evmVersion =
      result.EVMVersion === 'Default' ? undefined : result.EVMVersion;
    const optimizer = {
      enabled:
        result.OptimizationUsed === '1' || result.OptimizationUsed === 'true',
      runs:
        result.OptimizationRuns !== undefined
          ? parseInt(result.OptimizationRuns)
          : parseInt(result.Runs),
    };
    // old version got libraries here, but we don't actually want that!
    if (evmVersion !== undefined) {
      return {
        optimizer,
        evmVersion,
      };
    }
    return {
      optimizer,
    };
  }

  private processLibraries(
    librariesString: string | undefined,
  ): LibrarySettings {
    let libraries: Libraries;
    if (!librariesString || librariesString === '') {
      libraries = {};
    } else {
      libraries = Object.assign(
        {},
        ...librariesString.split(';').map(pair => {
          const [name, address] = pair.split(':');
          return { [name]: Web3Utils.toChecksumAddress(address) };
        }),
      );
    }
    return { '': libraries }; // empty string as key means it applies to all contracts
  }

  private extractVyperSettings(result: EtherscanResult): VyperSettings {
    const evmVersion =
      result.EVMVersion === 'Default' ? undefined : result.EVMVersion;
    // the optimize flag is not currently supported by etherscan;
    // any Vyper contract currently verified on etherscan necessarily has
    // optimize flag left unspecified (and therefore effectively true).
    // do NOT look at OptimizationUsed for Vyper contracts; it will always
    // be "0" even though in fact optimization *was* used.  just leave
    // the optimize flag unspecified.
    if (evmVersion !== undefined) {
      return { evmVersion };
    }
    return {};
  }
}

export class BackstageEtherscanProvider extends ethers.providers
  .EtherscanProvider {
  constructor(network?: Networkish, apiKey?: string) {
    const standardNetwork = networksByName[network as string];

    if (!standardNetwork) throw Error(`unsupported network${network}`);

    super(standardNetwork, apiKey);
  }

  getBaseUrl(): string {
    const domain = EtherscanClient.apiDomainsByNetworkName[this.network.name];
    return `https://${domain}`;
  }
}

export interface SourceInfo {
  contractName?: string;
  sources: SourcesByPath;
  options: CompilerOptions;
  etherScanResult: EtherscanResult;
}

// apologies for this being stringly-typed, but that's how
// Etherscan does it
interface EtherscanResult {
  SourceCode: string; // really: string | SolcSources | SolcInput
  ABI: string; // really: it's the ABI [we won't use this]
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string; // really: a number used as a boolean
  Runs: string; // really: a number
  OptimizationRuns?: string; // equivalent of Runs for Blockscout
  ConstructorArguments: string; // encoded as hex string, no 0x in front
  EVMVersion: string;
  Library?: string; // semicolon-delimited list of colon-delimited name-address pairs (addresses lack 0x in front)
  LicenseType: string; // ignored
  Proxy?: string; // boolean; used to signify that this contract is a proxy for another contract
  IsProxy?: string; // equivalent of Proxy for Blockscout
  Implementation?: string; // address; implementation only available if contract is proxy
  ImplementationAddress?: string; // equivalent of Implementation for Blockscout
  SwarmSource: string; // ignored
}

interface SourcesByPath {
  [sourcePath: string]: string;
}

// apologies if reinventing the wheel here
type CompilerOptions = SolcOptions | VyperOptions; // note: only Solidity really supported atm

interface SolcOptions {
  language: 'Solidity' | 'Yul'; // again, only Solidity really supported atm
  version: string;
  settings: SolcSettings;
  specializations: SolcSpecializations;
}

interface VyperOptions {
  language: 'Vyper';
  version: string;
  settings: VyperSettings;
  specializations: VyperSpecializations;
}

// only including settings that would alter compiled result
// (no outputSelection, no modelChecker once that exists, no stopAfter)
interface SolcSettings {
  remappings?: string[];
  optimizer?: OptimizerSettings;
  evmVersion?: string; // not gonna enumerate these
  debug?: DebugSettings;
  metadata?: MetadataSettings;
  viaIR?: boolean;
  libraries?: LibrarySettings; // note: we don't actually want to return this!
  compilationTarget?: {
    // not actually a valid compiler setting, but rather where the
    // contract name is stored! (as the lone value, the lone key being the source
    // where it's defined)
    [sourcePath: string]: string;
  };
}

interface VyperSettings {
  evmVersion?: string; // not gonna enumerate these
  optimize?: boolean; // warning: the Vyper compiler treats this as true if it's not specified!
  // also Etherscan currently doesn't support this flag; any Vyper contract currently
  // verified on Etherscan necessarily has this field unspecified (and thus effectively true)
}

interface SolcSpecializations {
  libraries?: LibrarySettings;
  constructorArguments?: string; // encoded, as hex string, w/o 0x in front
}

interface VyperSpecializations {
  constructorArguments?: string; // encoded, as hex string, w/o 0x in front
}

interface SolcSources {
  [sourcePath: string]: {
    keccak256?: string;
    content?: string; // for Etherscan we assume this exists
    urls?: string;
  };
}

interface SolcInput {
  language: 'Solidity';
  sources: SolcSources;
  settings: SolcSettings;
}

interface LibrarySettings {
  [contractPath: string]: Libraries;
}

interface Libraries {
  [libraryName: string]: string;
}

interface MetadataSettings {
  useLiteralContent?: boolean;
  bytecodeHash?: 'none' | 'ipfs' | 'bzzr1';
}

interface DebugSettings {
  revertStrings?: 'default' | 'strip' | 'debug' | 'verboseDebug';
}

interface OptimizerSettings {
  enabled?: boolean;
  runs?: number;
  details?: OptimizerDetails;
}

interface OptimizerDetails {
  peephole?: boolean;
  jumpdestRemover?: boolean;
  orderLiterals?: boolean;
  deduplicate?: boolean;
  cse?: boolean;
  constantOptimizer?: boolean;
  yul?: boolean;
  yulDetails?: YulDetails;
}

interface YulDetails {
  stackAllocation?: boolean;
  optimizerSteps?: string;
}

interface EtherscanSuccess {
  status: '1';
  message: string;
  result: EtherscanResult[];
}

interface EtherscanFailure {
  status: '0';
  message: string;
  result: string;
}

type FetchTransactionsOpts = Partial<{
  startblock: number;
  endblock: number;
  page: number;
  offset: number;
  sort: 'asc' | 'desc';
}>;

type EtherscanTxlistResponse = {
  status: '0' | '1';
  message: string;
  result: EtherscanTx[];
};

type EtherscanTxInfoResponse = {
  message: string;
  result: EtherscanTx;
};

type BlockscoutV2AddressResponse = {
  creation_tx_hash: string;
  creator_address_hash: string;
};

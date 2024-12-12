import util from 'util';
import { AbiItem } from 'web3-utils';
import { EtherscanTx } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { getRootLogger } from '@backstage/backend-common';
import axios from 'axios';
import retry from 'async-retry';
import { ethers } from 'ethers';
import { Networkish } from '@ethersproject/providers';
import {
  isSiloName,
  NETWORKS_BY_NAME,
  SILO_NAMES_BY_CHAIN_ID,
} from './networks';
import {
  processJsonResult,
  processMultiResult,
  processSingleResult,
  processVyperResult,
  SolcInput,
  SolcSources,
  SourceInfo,
  UnifiedSourceResponse,
  UnifiedTransactionResponse,
} from './explorer';

const makeTimer = util.promisify(setTimeout);

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
    aurora: 'old.explorer.aurora.dev',
    'testnet-aurora': 'explorer.old.testnet.aurora.dev',
    celo: 'api.celoscan.xyz',
    'alfajores-celo': 'api-alfajores.celoscan.xyz',
    clover: 'api.clvscan.com',
    // TODO: handle using hex convention
    ...Object.values(SILO_NAMES_BY_CHAIN_ID).reduce(
      (acc, siloName) => ({
        ...acc,
        [siloName]: `explorer.${siloName}.aurora.dev`,
      }),
      {},
    ),
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
    const response = await this.fetchSourceWithRetry(address);
    if (response.proxy) {
      const implementationAddress = response.implementation;
      if (implementationAddress) {
        try {
          const impResponse = await this.fetchSourceWithRetry(
            implementationAddress,
          );
          const proxyResult = this.processResult(response);
          const impResult = this.processResult(impResponse);
          if (proxyResult) {
            return {
              ...proxyResult,
              sources: {
                ...proxyResult.sources,
                ...impResult?.sources,
              },
              explorerResult: impResponse,
            };
          }
          return impResult;
        } catch (e) {
          // todo: handle this edge case without erroring
          // fail gracefully when proxy is verified but imp contract is not
        }
      }
    }
    return this.processResult(response);
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
  ): Promise<UnifiedTransactionResponse> {
    const initialTimeoutFactor = 1.5;
    const response = await retry(
      async () =>
        isSiloName(this.networkName) ||
        this.networkName === 'aurora' ||
        this.networkName === 'testnet-aurora'
          ? await this.fetchBlockscoutV2CreationTransaction(address)
          : await this.fetchTransactions(address, {
              page: 1,
              offset: 10,
              sort: 'asc',
            }),
      {
        retries: 3,
        minTimeout: this.delay * initialTimeoutFactor,
      },
    );
    return toUnifiedTransactionResponse(response);
  }

  private async fetchBlockscoutV2CreationTransaction(
    address: string,
  ): Promise<BlockscoutV2TransactionResponse> {
    const domain = this.determineUrl();
    // not putting a try/catch around this; if it throws, we throw
    await this.ready;
    const creationTxPromise = axios.get<BlockscoutV2AddressResponse>(
      `${domain}/v2/addresses/${address}`,
    );
    this.ready = makeTimer(this.delay);
    const { data: addressData } = await creationTxPromise;

    await this.ready;
    const txInfoPromise = axios.get<BlockscoutV2TransactionResponse>(
      `${domain}/v2/transactions/${addressData.creation_tx_hash}`,
    );
    this.ready = makeTimer(this.delay);
    const { data: txInfo } = await txInfoPromise;
    if (txInfo.status !== 'ok') throw new Error(txInfo.result);

    return txInfo;
  }

  private async fetchSourceWithRetry(
    address: string,
  ): Promise<UnifiedSourceResponse> {
    const initialTimeoutFactor = 1.5;
    const response = await retry(
      async () =>
        isSiloName(this.networkName) ||
        this.networkName === 'aurora' ||
        this.networkName === 'testnet-aurora'
          ? await this.fetchBlockscoutV2Source(address)
          : await this.fetchEtherscanSource(address),
      {
        retries: 3,
        minTimeout: this.delay * initialTimeoutFactor,
      },
    );
    return toUnifiedSourceResponse(response);
  }

  private determineUrl() {
    const domain = EtherscanClient.apiDomainsByNetworkName[this.networkName];
    return `https://${domain}/api`;
  }

  private async fetchEtherscanSource(address: string) {
    // not putting a try/catch around this; if it throws, we throw
    await this.ready;
    const responsePromise = axios.get<EtherscanSourceCodeResponse>(
      this.determineUrl(),
      {
        params: {
          module: 'contract',
          action: 'getsourcecode',
          address,
          apiKey: this.apiKey,
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

  private async fetchBlockscoutV2Source(address: string) {
    // not putting a try/catch around this; if it throws, we throw
    const domain = this.determineUrl();
    await this.ready;
    const contractPromise = axios.get<BlockscoutV2SmartContractResponse>(
      `${domain}/v2/smart-contracts/${address}`,
    );
    this.ready = makeTimer(this.delay);
    const contractResponse = (await contractPromise).data;

    await this.ready;
    const addressPromise = axios.get<BlockscoutV2AddressResponse>(
      `${domain}/v2/addresses/${address}`,
    );
    this.ready = makeTimer(this.delay);

    const addressResponse = (await addressPromise).data;
    return { ...contractResponse, ...addressResponse };
  }

  private processResult(result: UnifiedSourceResponse): SourceInfo | null {
    // we have 5 cases here.
    // case 1: the address doesn't exist
    if (
      result.sourceCode &&
      result.sourceCode === '' &&
      result.abi &&
      result.abi === 'Contract source code not verified'
    ) {
      return null;
    }
    // case 2: it's a Vyper contract
    if (result.compilerVersion.startsWith('vyper:')) {
      return processVyperResult(result);
    }
    let multifileJson: SolcSources;
    try {
      // try to parse the source JSON.  if it succeeds,
      // we're in the multi-file case.
      multifileJson = JSON.parse(result.sourceCode);
    } catch (_) {
      // otherwise, we could be single-file or we could be full JSON.
      // for full JSON input, etherscan will stick an extra pair of braces around it
      if (
        result.sourceCode.startsWith('{') &&
        result.sourceCode.endsWith('}')
      ) {
        const trimmedSource = result.sourceCode.slice(1).slice(0, -1); // remove braces
        let fullJson: SolcInput;
        try {
          fullJson = JSON.parse(trimmedSource);
        } catch (__) {
          // if it still doesn't parse, it's single-source I guess?
          // (note: we shouldn't really end up here?)
          this.logger.debug('single-file input??');
          return processSingleResult(result);
        }
        // case 5: full JSON input
        this.logger.debug('json input');
        return processJsonResult(result, fullJson);
      }
      // case 3 (the way it should happen): single source
      this.logger.debug('single-file input');
      return processSingleResult(result);
    }
    // case 4: multiple sources
    this.logger.debug('multi-file input');
    return processMultiResult(result, multifileJson);
  }
}

export class BackstageEtherscanProvider extends ethers.providers
  .EtherscanProvider {
  constructor(networkish: Networkish, apiKey?: string) {
    if (typeof networkish === 'string') {
      const standardNetwork = NETWORKS_BY_NAME[networkish];
      if (!standardNetwork) throw Error(`unsupported network: ${networkish}`);

      super(standardNetwork, apiKey);
    } else {
      super(networkish, apiKey);
    }
  }

  getBaseUrl(): string {
    const domain = EtherscanClient.apiDomainsByNetworkName[this.network.name];
    return `https://${domain}`;
  }
}

function toUnifiedTransactionResponse(
  res: BlockscoutV2TransactionResponse | EtherscanTxlistResponse,
): UnifiedTransactionResponse {
  if ('block' in res) {
    return {
      blockHash: '',
      blockNumber: res.block,
      timestamp: res.timestamp,
      txStatus: res.status,
      confirmations: res.confirmations,
    };
  }
  const [result] = res.result;
  return {
    blockHash: result.blockHash,
    blockNumber: parseInt(result.blockNumber),
    timestamp: result.timeStamp,
    txStatus: result.txreceipt_status,
    confirmations: parseInt(result.confirmations),
  };
}

function toUnifiedSourceResponse(
  res: EtherscanSourceCodeResponse | BlockscoutV2SourceResponse,
): UnifiedSourceResponse {
  if ('result' in res) {
    const result = res.result[0];
    return {
      abi: result.ABI,
      contractName: result.ContractName,
      sourceCode: result.SourceCode,
      optimizationEnabled:
        result.OptimizationUsed === '1' || result.OptimizationUsed === 'true',
      optimizationRuns:
        result.OptimizationRuns !== undefined
          ? parseInt(result.OptimizationRuns)
          : parseInt(result.Runs),
      compilerVersion: result.CompilerVersion,
      evmVersion: result.EVMVersion,
      contructorArguments: result.ConstructorArguments,
      libraries: result.Library,
      proxy: Boolean(result.Proxy) || Boolean(result.IsProxy),
      implementation: result.Implementation || result.ImplementationAddress,
    };
  }
  return {
    abi: JSON.stringify(res.abi),
    contractName: res.name,
    sourceCode: res.source_code,
    optimizationEnabled: res.optimization_enabled,
    optimizationRuns: res.optimization_runs,
    compilerVersion: res.compiler_version,
    evmVersion: res.evm_version,
    contructorArguments: res.constructor_args,
    libraries: res.external_libraries
      .map(lib => `${lib.name}-${lib.address_hash}`)
      .join(';'),
    proxy: res.implementations !== null && res.implementations.length > 0,
    implementation:
      res.implementations !== null && res.implementations.length > 0
        ? res.implementations[0].address
        : undefined,
  };
}

interface FetchTransactionsOpts
  extends Partial<{
    startblock: number;
    endblock: number;
    page: number;
    offset: number;
    sort: 'asc' | 'desc';
  }> {}

interface EtherscanGenericResponse<T> {
  /**
   * '1' = success, '0' = error
   */
  status: '1' | '0';
  message: string;
  result: T;
}

interface EtherscanTxlistResponse
  extends EtherscanGenericResponse<EtherscanTx[]> {}

interface EtherscanSourceCodeResponse
  extends EtherscanGenericResponse<EtherscanBlockscoutV1SourceCodeResult[]> {}

// apologies for this being stringly-typed, but that's how
// Etherscan does it
interface EtherscanBlockscoutV1SourceCodeResult {
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

export interface BlockscoutV2TransactionResponse {
  block: number;
  confirmations: number;
  status: 'ok' | 'error';
  result: string;
  timestamp: string;
}

interface BlockscoutV2SmartContractResponse {
  source_code: string;
  abi: AbiItem[];
  name: string;
  compiler_version: string;
  optimization_enabled: boolean;
  optimization_runs: number;
  constructor_args: string;
  evm_version: string;
  external_libraries: { name: string; address_hash: string }[];
  minimal_proxy_address_hash: string | null; // todo: investigate why this isn't populated
  implementations: { address: string; name: string }[];
}

interface BlockscoutV2AddressResponse {
  creation_tx_hash: string;
  creator_address_hash: string;
  implementation_address: string | null;
  is_contract: boolean;
  is_verified: boolean;
}

interface BlockscoutV2SourceResponse
  extends BlockscoutV2SmartContractResponse,
    BlockscoutV2AddressResponse {}

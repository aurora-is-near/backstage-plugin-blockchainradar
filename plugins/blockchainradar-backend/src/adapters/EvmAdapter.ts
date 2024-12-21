import Web3 from 'web3';
import { getRootLogger } from '@backstage/backend-common';
import { Config } from '@backstage/config';
import { ethers } from 'ethers';
import {
  ContractSourceSpec,
  ContractStateSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import {
  EtherscanProvider,
  StaticJsonRpcProvider,
} from '@ethersproject/providers';
import { EtherscanClient } from '../lib/EtherscanClient';
import {
  NetworkConfig,
  SILO_NAMES_BY_CHAIN_ID,
  defaultNetworks,
  isSiloChainId,
  isSiloName,
} from '../lib/networks';
import { BlockchainAdapter } from './BlockchainAdapter';
import { capitalize } from '../lib/utils';

export class EvmAdapter extends BlockchainAdapter {
  public networkName: string;
  public networkConfig: NetworkConfig;

  constructor(
    config: Config,
    network: string,
    networkType: string,
    logger = getRootLogger(),
  ) {
    super(config, network, networkType, logger);
    // todo: use config registry to find network name
    this.networkType = isSiloChainId(networkType)
      ? SILO_NAMES_BY_CHAIN_ID[networkType]
      : this.networkType;
    this.networkName = `${this.network}${capitalize(this.networkType)}`;
    const defaultConfig = defaultNetworks[this.networkName];
    const configured: NetworkConfig | undefined = config.getOptional(
      this.networkName,
    );
    this.networkConfig = {
      chainId:
        configured?.chainId ||
        defaultConfig.chainId ||
        defaultNetworks.ethereumMainnet.chainId,
      rpcUrl:
        configured?.rpcUrl ||
        defaultConfig.rpcUrl ||
        defaultNetworks.ethereumMainnet.rpcUrl,
      explorerApiUrl:
        configured?.explorerApiUrl ||
        defaultConfig.explorerApiUrl ||
        defaultNetworks.ethereumMainnet.explorerApiUrl,
      explorerApiKey: configured?.explorerApiKey,
      explorerUrl:
        configured?.explorerUrl ||
        defaultConfig.explorerUrl ||
        defaultNetworks.ethereumMainnet.explorerUrl,
    };
  }

  isValidAddress(address: string): boolean {
    return Web3.utils.isAddress(address);
  }

  normalizeAddress(address: string) {
    return Web3.utils.toChecksumAddress(address);
  }

  getNetwork() {
    if (isSiloName(this.networkType)) {
      return this.networkType;
    }
    if (this.network === 'aurora' && this.networkType === 'mainnet') {
      return 'aurora';
    }
    if (this.network === 'aurora' && this.networkType === 'testnet') {
      return 'testnet-aurora';
    }
    return this.networkType;
  }

  // TODO add caching?
  async isContract(address: string): Promise<boolean> {
    const provider = new StaticJsonRpcProvider(this.networkConfig.rpcUrl);

    // NOTE: for deprecated networks this may fail,
    // gracefully handle so that processing component
    // is not blocked by contract-detection
    try {
      const bytecode = await provider.getCode(address);
      return bytecode !== '0x';
    } catch {
      return false;
    }
  }

  public async fetchSourceSpec(address: string) {
    const fetcher = new EtherscanClient(
      this.getNetwork(),
      this.networkConfig.explorerApiUrl,
      this.networkConfig.explorerApiKey,
    );
    const result = await fetcher.fetchSourcesForAddress(address);
    await this.delayRequest();
    const firstTx = await this.fetchCreationTransaction(address);

    if (result) {
      return {
        sourceCodeVerified: true,
        fetchDate: Date.now(),
        contractName: result.explorerResult.contractName,
        sourceFiles: Object.keys(result.sources),
        abi: JSON.stringify(JSON.parse(result.explorerResult.abi), null, 2),
        startBlock: firstTx ? firstTx.blockNumber : 0,
      };
    }
    this.logger.warn(`unable to fetch abi for ${address}`);
    return undefined;
  }

  public async fetchStateSpec(
    address: string,
    sourceSpec: ContractSourceSpec,
  ): Promise<ContractStateSpec | undefined> {
    if (!sourceSpec.abi) {
      this.logger.debug('no abi is available, unable to fetch state');
      return undefined;
    }

    const provider =
      this.network === 'aurora'
        ? new StaticJsonRpcProvider(this.networkConfig.rpcUrl)
        : new EtherscanProvider(
            this.networkConfig.chainId,
            this.networkConfig.explorerApiKey,
          );

    const contract = new ethers.Contract(address, sourceSpec.abi).connect(
      provider,
    );

    const stateSpec: ContractStateSpec = {
      fetchDate: Date.now(),
      methods: {},
      interactsWith: {},
    };

    for (const [name, def] of Object.entries(
      contract.interface.functions,
    ).filter(([n]) => n.includes('ROLE'))) {
      if (def.inputs.length !== 0) continue;

      try {
        if (def.constant && def.outputs?.length === 1) {
          const method = name.replace('()', '');
          const fn: ethers.ContractFunction<string[]> =
            contract.functions[method];
          const result = await fn();
          stateSpec.methods[method] = result[0];
        }
      } catch (e) {
        this.logger.debug(`error calling ${name}: ${(e as Error).message}`);
      }
      await this.delayRequest();
    }

    for (const [name, def] of Object.entries(
      contract.interface.functions,
    ).filter(([n]) => !n.includes('ROLE'))) {
      if (def.inputs.length !== 0) continue;

      try {
        const result = (await contract.functions[name]()) as string[];
        const method = name.replace('()', '');
        if (
          def.constant &&
          def.outputs?.length === 1 &&
          def.outputs[0].type === 'address'
        ) {
          stateSpec.interactsWith[method] = result[0];
          this.logger.debug(`interactsWith: ${method} => ${result[0]}`);
        } else {
          stateSpec.methods[method] = JSON.stringify(
            result.length === 1 ? result[0] : result,
          );
        }
      } catch (e) {
        this.logger.debug(`error calling ${name}: ${(e as Error).message}`);
      }
      await this.delayRequest();
    }
    return stateSpec;
  }

  public async fetchLastTransaction(address: string) {
    const fetcher = new EtherscanClient(
      this.getNetwork(),
      this.networkConfig.explorerApiUrl,
      this.networkConfig.explorerApiKey,
    );

    try {
      const { result } = await fetcher.fetchTransactions(address);
      return result.length > 0 ? result[0] : undefined;
    } catch (err) {
      this.logger.warn(`unable to fetch transactions for ${address}`);
      return undefined;
    }
  }

  public async fetchFirstTransaction(address: string) {
    const fetcher = new EtherscanClient(
      this.getNetwork(),
      this.networkConfig.explorerApiUrl,
      this.networkConfig.explorerApiKey,
    );

    try {
      const { result } = await fetcher.fetchTransactions(address, {
        page: 1,
        offset: 1,
        sort: 'asc',
      });
      return result.length > 0 ? result[0] : undefined;
    } catch (err) {
      this.logger.warn(`unable to fetch transactions for ${address}`);
      return undefined;
    }
  }

  public async fetchCreationTransaction(address: string) {
    const fetcher = new EtherscanClient(
      this.getNetwork(),
      this.networkConfig.explorerApiUrl,
      this.networkConfig.explorerApiKey,
    );
    try {
      const response = await fetcher.fetchCreationTransaction(address);
      return response;
    } catch (err) {
      this.logger.warn(`unable to fetch creation tx for ${address}`);
      return undefined;
    }
  }
}

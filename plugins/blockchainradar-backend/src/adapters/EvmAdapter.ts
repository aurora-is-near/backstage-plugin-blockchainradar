import Web3 from 'web3';
import { BlockchainAdapter } from './BlockchainAdapter';
import { ethers } from 'ethers';
import {
  BackstageEtherscanProvider,
  EtherscanFetcher,
} from '../lib/EtherscanFetcher';
import {
  ContractSourceSpec,
  ContractStateSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { StaticJsonRpcProvider } from '@ethersproject/providers';

export class EvmAdapter extends BlockchainAdapter {
  isValidAddress(address: string): boolean {
    return Web3.utils.isAddress(address);
  }

  normalizeAddress(address: string) {
    return Web3.utils.toChecksumAddress(address);
  }

  etherscanCreds() {
    const networkName = `${this.network}-${this.networkType}`;
    const network = this.config.getString(`etherscan.${networkName}.network`);
    const apiKey = this.config.getString(`etherscan.${networkName}.apiKey`);
    return { network, apiKey };
  }

  // TODO add caching?
  async isContract(address: string): Promise<boolean> {
    const creds = this.etherscanCreds();
    const provider = new BackstageEtherscanProvider(
      creds.network,
      creds.apiKey,
    );
    if (this.network === 'aurora') {
      const auroraProvider = new StaticJsonRpcProvider(
        'https://mainnet.aurora.dev/api',
      );
      const code = await auroraProvider.getCode(address);
      return code !== '0x';
    }
    const bytecode = await provider.getCode(address);
    return bytecode !== '0x';
  }

  async fetchSourceSpec(address: string) {
    const creds = this.etherscanCreds();
    const fetcher = new EtherscanFetcher(creds.network, creds.apiKey);
    const result = await fetcher.fetchSourcesForAddress(address);

    if (result) {
      return {
        sourceCodeVerified: true,
        fetchDate: Date.now(),
        contractName: result.etherScanResult.ContractName,
        sourceFiles: Object.keys(result.sources),
        abi: JSON.stringify(JSON.parse(result.etherScanResult.ABI), null, 2),
      };
    }
    this.logger.warn(`unable to fetch abi for ${address}`);
    return undefined;
  }

  async fetchStateSpec(
    address: string,
    sourceSpec: ContractSourceSpec,
  ): Promise<ContractStateSpec | undefined> {
    if (!sourceSpec.abi) {
      this.logger.debug('no abi is available, unable to fetch state');
      return undefined;
    }

    const creds = this.etherscanCreds();
    const provider = new BackstageEtherscanProvider(
      creds.network,
      creds.apiKey,
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
          const fn: ethers.ContractFunction<string []> = contract.functions[method];
          const result = await fn();
          stateSpec.methods[method] = result[0];
        }
      } catch (e) {
        this.logger.debug(`error calling ${name}: ${(e as Error).message}`);
      }
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

  async fetchLastTransaction(address: string) {
    const creds = this.etherscanCreds();
    const fetcher = new EtherscanFetcher(creds.network, creds.apiKey);

    try {
      const { result } = await fetcher.fetchTransactions(address);
      return result.length > 0 ? result[0] : undefined;
    } catch (err) {
      this.logger.warn(`unable to fetch transactions for ${address}`);
      return undefined;
    }
  }
}

import * as nearAPI from 'near-api-js';
import { BlockchainAdapter } from './BlockchainAdapter';
import { parseContract } from 'near-contract-parser';
import {
  ContractSourceSpec,
  ContractStateSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { CodeResult } from 'near-api-js/lib/providers/provider';
import { NearBlocksClient } from '../lib/NearBlocksClient';
import { getRootLogger } from '@backstage/backend-common';
import { Config } from '@backstage/config';

type ViewCodeNear = {
  block_hash: string;
  block_height: number;
  code_base64: string;
};
export class NearAdapter extends BlockchainAdapter {
  constructor(
    config: Config,
    network: string,
    networkType: string,
    logger = getRootLogger(),
  ) {
    super(config, network, networkType, logger);
    this.nearConfig = {
      networkId: networkType,
      keyStore: new nearAPI.keyStores.InMemoryKeyStore(),
      nodeUrl: `https://rpc.${networkType}.near.org`,
      walletUrl: `https://wallet.${networkType}.near.org`,
      helperUrl: `https://helper.${networkType}.near.org`,
      headers: {},
      // explorerUrl: "https://explorer.mainnet.near.org",
    };

    this.nearBlocksClient = new NearBlocksClient(this.networkType, {
      apiKey: config.getOptionalString('nearblocks.apiKey'),
      requestsPerSecond: config.getOptionalNumber(
        'nearblocks.requestsPerSecond',
      ),
      logger: this.logger,
    });
  }
  nearConfig: nearAPI.ConnectConfig;
  isHumanReadable = true;
  nearBlocksClient: NearBlocksClient;

  private near?: nearAPI.Near;

  // it's very rare that .near addresses are too long
  public humanFriendlyAddress(address: string) {
    return address.length === 64
      ? `${address.slice(0, 4)}...${address.slice(
          address.length - 4,
          address.length,
        )}`
      : address;
  }

  public async connectApi() {
    if (this.near) return this.near;
    this.near = await nearAPI.connect(this.nearConfig);
    return this.near;
  }

  async isContract(address: string): Promise<boolean> {
    await this.connectApi();
    const account = await this.near!.account(address);
    try {
      const state = await account.state();
      return state.code_hash !== '11111111111111111111111111111111';
    } catch (err) {
      return false;
    }
  }

  public async keys(address: string) {
    await this.connectApi();
    const account = await this.near!.account(address);
    return account.getAccessKeys();
  }

  /**
   * two types of addresses:
   * 1. c12ba79f1452cf363f40d878b6c8666737513a6411138a0caffe2029d2a93f7b
   * 2. account.near
   * TODO not sure how to get a full list of tlds
   *
   * for 1) and sometimes for 2) the resulting entity name will be longer than 63 characters and it won't pass backstage validation so it will be hashed
   */
  isValidAddress(address: string): boolean {
    return (
      !!address.match(/\.near$/) ||
      !!address.match(/\.aurora/) ||
      !!address.match(/\.testnet$/) ||
      !!address.match(/^[0-9a-fA-F]{64}$/) ||
      address === 'aurora'
    );
  }

  normalizeAddress(address: string) {
    return address.toLowerCase();
  }

  public async fetchSourceSpec(address: string) {
    // const account = await this.near!.account(this.address);
    // // logger.debug('account: ' + JSON.stringify(account, null, 2));
    // const details = await account.getAccountDetails();
    // logger.debug('details: ' + JSON.stringify(details, null, 2));
    // const response = await account.state();
    // logger.debug('response state: ' + JSON.stringify(response, null, 2));
    // todo check if contract
    // const keys = await account.getAccessKeys();
    // console.log('keys', JSON.stringify(keys, null, 2));
    // const viewState = await account.viewState('');
    // console.log('viewState', JSON.stringify(viewState, null, 2));
    await this.connectApi();
    const codeResponse: ViewCodeNear =
      await this.near!.connection.provider.query({
        account_id: address,
        finality: 'final',
        request_type: 'view_code',
      });
    const parsedContract = await parseContract(codeResponse.code_base64);
    await this.delayRequest();

    const firstTx = await this.fetchCreationTransaction(address);
    const sourceSpec: ContractSourceSpec = {
      sourceCodeVerified: false,
      fetchDate: Date.now(),
      contractName: address,
      sourceFiles: [],
      abi: JSON.stringify(parsedContract.byMethod, null, 2),
      startBlock: firstTx ? firstTx.block.block_height : 0,
    };
    return sourceSpec;
  }

  public async fetchStateSpec(address: string, sourceSpec: ContractSourceSpec) {
    const stateSpec: ContractStateSpec = {
      fetchDate: Date.now(),
      methods: {},
      interactsWith: {},
    };

    const byMethod = JSON.parse(sourceSpec.abi) as Record<string, string[]>;
    for (const [method, _args] of Object.entries(byMethod)) {
      await this.delayRequest();
      try {
        await this.connectApi();
        const rawResult =
          await this.near!.connection.provider.query<CodeResult>({
            request_type: 'call_function',
            account_id: address,
            method_name: method,
            args_base64: '',
            finality: 'optimistic',
          });

        const result = Buffer.from(rawResult.result).toString();

        try {
          // for some reason addresses look like "prover.bridge.near" (with "")
          const potentialAddress = result.replace(/"/g, '');
          if (this.isValidAddress(potentialAddress)) {
            stateSpec.interactsWith[method] = potentialAddress;
          } else {
            const parsedResult = JSON.parse(result);
            stateSpec.methods[method] = JSON.stringify(parsedResult);
          }
        } catch (e) {
          this.logger.debug(`non-json output for ${method}: ${result}`);
        }
      } catch (e) {
        this.logger.debug(`error calling ${method}`);
      }
    }
    return stateSpec;
  }

  public async fetchFirstTransaction(address: string) {
    return this.nearBlocksClient.getFirstTransaction(address);
  }

  public async fetchLastTransaction(address: string) {
    return this.nearBlocksClient.getLastTransaction(address);
  }

  public async fetchCreationTransaction(address: string) {
    return this.nearBlocksClient.getCreationTransaction(address);
  }
}

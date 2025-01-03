import util from 'util';
import axios, { AxiosInstance } from 'axios';
import { NearTx } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { Logger } from 'winston';
import { getRootLogger } from '@backstage/backend-common';

const defaultTxnsParams = { page: '1', per_page: '10', order: 'desc' };
const NEAR_BLOCKS_API_KEY = process.env.NEAR_BLOCKS_API_KEY;

const makeTimer = util.promisify(setTimeout);

export class NearBlocksClient {
  logger: Logger;
  axios: AxiosInstance;

  private readonly delay: number; // minimum # of ms to wait between requests
  private ready: Promise<void>; // always await this timer before making a request.
  constructor(networkType: string, logger = getRootLogger()) {
    this.logger = logger.child({ class: this.constructor.name, networkType });
    this.axios = axios.create({
      baseURL: this.getBaseUrl(networkType),
      headers: {
        Authorization: `Bearer ${NEAR_BLOCKS_API_KEY}`,
      },
    });
    const baseDelay = 10000; // nearblocks permits 6 req/m
    const safetyFactor = 1; // no safety factor atm
    this.delay = baseDelay * safetyFactor;
    this.ready = makeTimer(0); // at start, it's ready to go immediately
  }

  public async getAccountTransactions(
    address: string,
    opts = defaultTxnsParams,
  ) {
    try {
      const params = new URLSearchParams(opts || defaultTxnsParams);
      await this.ready;
      const response = await this.axios.get<TxnsResponse>(
        `account/${address}/txns?${params.toString()}`,
      );
      this.ready = makeTimer(this.delay);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(
          `Error message: ${error.response?.data.message}`,
          error,
        );
      } else {
        this.logger.error('Unexpected error: ', error);
      }
      return { txns: [] };
    }
  }

  public async getContractDeployments(address: string) {
    try {
      await this.ready;
      const response = await this.axios.get<ContractDeploymentsResponse>(
        `account/${address}/contract/deployments`,
      );
      this.ready = makeTimer(this.delay);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(
          `Error message: ${error.response?.data.message}`,
          error,
        );
      } else {
        this.logger.error('Unexpected error: ', error);
      }
      return { deployments: [] };
    }
  }

  public async getTransactionInfo(hash: string) {
    try {
      await this.ready;
      const response = await this.axios.get<TxnsResponse>(`txns/${hash}`);
      this.ready = makeTimer(this.delay);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(
          `Error message: ${error.response?.data.message}`,
          error,
        );
      } else {
        this.logger.error('Unexpected error: ', error);
      }
      return { txns: [] };
    }
  }

  public async getFirstTransaction(address: string) {
    const { txns } = await this.getAccountTransactions(address, {
      ...defaultTxnsParams,
      per_page: '1',
      order: 'asc',
    });
    if (!txns.length) {
      return undefined;
    }
    const [firstTx] = txns;
    return firstTx;
  }

  public async getLastTransaction(address: string) {
    const { txns } = await this.getAccountTransactions(address, {
      ...defaultTxnsParams,
      per_page: '1',
    });
    if (!txns.length) {
      return undefined;
    }
    const [lastTx] = txns;
    return lastTx;
  }

  public async getCreationTransaction(address: string) {
    const { deployments } = await this.getContractDeployments(address);
    if (!deployments.length) {
      return undefined;
    }
    const [firstDeployment] = deployments;
    const { txns } = await this.getTransactionInfo(
      firstDeployment.transaction_hash,
    );
    if (!txns.length) {
      return undefined;
    }
    const [deployTx] = txns;
    return deployTx;
  }

  private getBaseUrl(networkType: string) {
    return `https://api${
      networkType === 'testnet' ? '-testnet' : ''
    }.nearblocks.io/v1`;
  }
}

type TxnsResponse = {
  txns: NearTx[];
};

type ContractDeploymentsResponse = {
  deployments: {
    transaction_hash: string;
    block_timestamp: string;
  }[];
};

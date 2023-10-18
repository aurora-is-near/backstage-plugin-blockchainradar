import axios, { AxiosInstance } from 'axios';
import { NearTx } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { Logger } from 'winston';
import { getRootLogger } from '@backstage/backend-common';

const defaultTxnsParams = { page: '1', per_page: '10', order: 'desc' };
const NEAR_BLOCKS_API_KEY = process.env.NEAR_BLOCKS_API_KEY;

export class NearBlocksClient {
  logger: Logger;
  axios: AxiosInstance;

  constructor(networkType: string, logger = getRootLogger()) {
    this.logger = logger.child({ class: this.constructor.name, networkType });
    this.axios = axios.create({
      baseURL: this.getBaseUrl(networkType),
      headers: {
        Authorization: `Bearer ${NEAR_BLOCKS_API_KEY}`,
      },
    });
  }

  public async getAccountTransactions(
    address: string,
    opts = defaultTxnsParams,
  ) {
    try {
      const params = new URLSearchParams(opts || defaultTxnsParams);
      const response = await this.axios.get<TxnsResponse>(
        `account/${address}/txns?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
      return { txns: [] };
    }
  }

  public async getContractDeployments(address: string) {
    try {
      const response = await this.axios.get<ContractDeploymentsResponse>(
        `account/${address}/contract/deployments`,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
      return { deployments: [] };
    }
  }

  public async getTransactionInfo(hash: string) {
    try {
      const response = await this.axios.get<TxnsResponse>(`txns/${hash}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
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

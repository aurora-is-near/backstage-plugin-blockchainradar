import axios from 'axios';
import { NearTx } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { Logger } from 'winston';

type TxnsResponse = {
  txns: NearTx[];
};

const defaultTxnsParams = { page: '1', per_page: '10', order: 'desc' };
type TxnsParams = typeof defaultTxnsParams;
const NEAR_BLOCKS_URL = 'https://api.nearblocks.io/v1';
const NEAR_BLOCKS_API_KEY = process.env.NEAR_BLOCKS_API_KEY;
const instance = axios.create({
  baseURL: NEAR_BLOCKS_URL,
  headers: {
    Authorization: `Bearer ${NEAR_BLOCKS_API_KEY}`,
  },
});

export class NearBlocksClient {
  private logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ class: this.constructor.name })
  }

  public async getAccountTransactions(address: string, opts?: TxnsParams) {
    try {
      const params = new URLSearchParams(opts || defaultTxnsParams);
      const response = await instance.get<TxnsResponse>(
        `account/${address}/txns?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
      throw error;
    }
  }

  public async getLastTransaction(address: string) {
    const { txns } = await this.getAccountTransactions(address, {
      ...defaultTxnsParams,
      per_page: '1',
    });
    const [lastTx] = txns;
    return lastTx;
  }
}

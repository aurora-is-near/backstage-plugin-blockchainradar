import axios from 'axios';
import { getRootLogger } from '@backstage/backend-common';

type NearTx = {
  receipt_id: string;
  predecessor_account_id: string;
  receiver_account_id: string;
  transaction_hash: string;
  included_in_block_hash: string;
  block_timestamp: string;
  block: { block_height: number };
};
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
  accountId: string;
  private logger = getRootLogger();

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  public async getAccountTransactions(opts?: TxnsParams) {
    try {
      const params = new URLSearchParams(opts || defaultTxnsParams);
      const response = await instance.get<TxnsResponse>(
        `account/${this.accountId}/txns?${params.toString()}`,
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

  public async getLastTransaction() {
    const { txns } = await this.getAccountTransactions({
      ...defaultTxnsParams,
      per_page: '1',
    });
    const [lastTx] = txns;
    return lastTx;
  }
}

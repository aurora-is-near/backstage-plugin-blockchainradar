import axios, { AxiosInstance } from 'axios';
import { getRootLogger } from '@backstage/backend-common';
import { Logger } from 'winston';

export class SafeClient {
  network: string;
  axios: AxiosInstance;
  logger: Logger;

  constructor(network: string, logger = getRootLogger()) {
    this.network = network;
    this.axios = axios.create({
      baseURL: this.gnosisBaseUrl(),
      headers: {
        Accept: 'application/json',
      },
    });
    this.logger = logger.child({ class: this.constructor.name, network });
  }

  public async safeInfo(address: string) {
    try {
      return this.gnosisSafePolicy(address);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
      throw error;
    }
  }

  public async safeOwners(address: string) {
    try {
      return this.gnosisSafeOwners(address);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
        return [];
      }
      this.logger.error('unexpected error: ', error);
      // todo emit errors
      // return 'An unexpected error occurred';
      throw error;
    }
  }

  private gnosisBaseUrl() {
    // todo: investigate if this handles testnets properly
    let subdomain = 'mainnet';
    if (this.network === 'aurora') {
      subdomain = 'aurora';
    }
    return `https://safe-transaction-${subdomain}.safe.global/api/`;
  }

  private getGnosisSafeInfo(address: string) {
    return this.axios.get<GnosisSafeResponse>(`v1/safes/${address}`);
  }

  private async gnosisSafeOwners(address: string) {
    const { data } = await this.getGnosisSafeInfo(address);
    return data.owners;
  }

  private async gnosisSafePolicy(address: string) {
    const { data } = await this.getGnosisSafeInfo(address);
    const { owners, threshold, version } = data;
    return {
      policy: {
        owners: owners.length,
        threshold,
      },
      version,
    };
  }
}

type GnosisSafeResponse = {
  version: string;
  owners: string[];
  threshold: number;
};

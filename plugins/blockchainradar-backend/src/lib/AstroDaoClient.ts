import { getRootLogger } from '@backstage/backend-common';
import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';

const ASTRO_DAO_API_URL = 'https://api.app.astrodao.com/api/';

export class AstroDaoClient {
  axios: AxiosInstance;
  logger: Logger;

  constructor(logger = getRootLogger()) {
    this.axios = axios.create({
      baseURL: ASTRO_DAO_API_URL,
      headers: {
        Accept: 'application/json',
      },
    });
    this.logger = logger.child({ class: this.constructor.name });
  }

  public async safeOwners(address: string) {
    try {
      const { data } = await this.getAstroDaoOwners(address);
      return data;
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

  public async safeInfo(address: string) {
    try {
      const { data } = await this.getAstroDaoInfo(address);
      const { policy, daoVersion, councilSeats } = data;
      const councilRole = policy.roles.find(r => r.name === 'council');

      const configVotePolicy = this.isValidCouncilRole(
        councilRole,
        councilSeats,
      )
        ? councilRole.votePolicy.config
        : undefined;

      // https://github.com/near-daos/sputnik-dao-contract/blob/main/README.md#voting-policy
      return {
        policy: {
          owners: councilSeats,
          threshold: this.threshold(
            councilSeats,
            configVotePolicy || policy.defaultVotePolicy,
          ),
        },
        version: daoVersion.version.join('.'),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
      throw error;
    }
  }

  public async safeVersion(address: string) {
    try {
      const { data } = await this.getAstroDaoInfo(address);
      const { daoVersion } = data;
      return daoVersion.version.join('.');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
      throw error;
    }
  }

  private getAstroDaoInfo(address: string) {
    return this.axios.get<AstroDaoInfoResponse>(`v1/daos/${address}`);
  }

  private getAstroDaoOwners(address: string) {
    return this.axios.get<AstroDaoMembersResponse>(
      `v1/daos/${address}/members`,
    );
  }

  private threshold(seats: number, policy: AstroDaoPolicyInfo) {
    const { ratio, weightKind } = policy;
    const [num, denom] = ratio;

    if (weightKind !== 'RoleWeight')
      throw new Error('TokenWeight not implemented');

    const threshold =
      // https://github.com/near-daos/sputnik-dao-contract/blob/f7bc52c0ba5e55040b84fba28aa9d9df8a153ea6/sputnikdao2/src/policy.rs#L93
      //  WeightOrRatio::Ratio(num, denom) => min(
      //          (*num as u128 * total_weight) / *denom as u128 + 1,
      //          total_weight,
      //      ),
      // WeightOrRatio::Weight(weight) => min(weight.0, total_weight) - not
      // implemented
      weightKind === 'RoleWeight'
        ? Math.min(Math.floor((num * seats) / denom) + 1, seats)
        : -1; // TokenWeight not implemented
    return threshold;
  }

  private isValidCouncilRole(
    councilRole?: AstroDaoRole,
    councilSeats?: number,
  ): councilRole is AstroDaoRole {
    if (!councilRole) {
      throw new Error('No council role found');
    }

    if (councilRole.accountIds.length !== councilSeats) {
      throw new Error(
        `Council role has ${councilRole.accountIds.length} members, expected ${councilSeats}`,
      );
    }

    if (councilRole.votePolicy) {
      const allPolicies = Object.entries(councilRole.votePolicy).map(
        ([_key, value]) => JSON.stringify(value),
      );
      const uniquePolicies = allPolicies.filter(
        (v, i) => i === allPolicies.lastIndexOf(v),
      );
      if (uniquePolicies.length > 1) {
        throw new Error('Council role has different vote policies');
      }
    }
    return true;
  }
}

type AstroDaoPolicyInfo = {
  weightKind: string;
  quorum: number;
  kind: string;
  ratio: number[];
};

type AstroDaoRole = {
  name: string;
  accountIds: string[];
  permissions: string[];
  votePolicy: Record<string, AstroDaoPolicyInfo>;
};

type AstroDaoInfoResponse = {
  councilSeats: number;
  policy: {
    defaultVotePolicy: AstroDaoPolicyInfo;
    roles: AstroDaoRole[];
  };
  daoVersion: {
    version: string[];
  };
};

type AstroDaoMembersResponse = { accountId: string; voteCount: number }[];

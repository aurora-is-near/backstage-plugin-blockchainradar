import { BlockchainAddress } from '../entities/BlockchainAddress';
import axios from 'axios';
import { getRootLogger } from '@backstage/backend-common';
import { BlockchainFactory } from '../lib/BlockchainFactory';

type AstroDaoMembersResponse = { accountId: string; voteCount: number }[];

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
type GnosisSafeResponse = {
  version: string;
  owners: string[];
  threshold: number;
};

export class SafeClient {
  safeAddress: BlockchainAddress;
  logger = getRootLogger();

  constructor(safeAddress: BlockchainAddress) {
    this.safeAddress = safeAddress;
  }

  newSafeOwner(ownerAddress: string) {
    return BlockchainFactory.fromBlockchainAddress(
      this.safeAddress,
      'signer',
      ownerAddress,
    );
  }

  private gnosisBaseUrl() {
    let subdomain = 'mainnet';
    if (this.safeAddress.network === 'aurora') {
      subdomain = 'aurora';
    }
    return `https://safe-transaction.${subdomain}.gnosis.io/api`;
  }

  private astroDaoUrl() {
    return 'https://api.app.astrodao.com';
  }

  private getGnosisSafeInfo() {
    return axios.get<GnosisSafeResponse>(
      `${this.gnosisBaseUrl()}/v1/safes/${this.safeAddress.address}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );
  }

  private getAstroDaoSafeInfo() {
    return axios.get<AstroDaoInfoResponse>(
      `${this.astroDaoUrl()}/api/v1/daos/${this.safeAddress.address}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );
  }

  private async gnosisSafeOwners() {
    const { data } = await this.getGnosisSafeInfo();
    // console.log('axoios reply data', data);
    const ownerEntities = data.owners.map(owner => this.newSafeOwner(owner));
    return Promise.all(ownerEntities);
  }

  private async astroDaoOwners() {
    const { data } = await axios.get<AstroDaoMembersResponse>(
      `${this.astroDaoUrl()}/api/v1/daos/${this.safeAddress.address}/members`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );
    // console.log('axios reply data', data);
    const ownerEntities = data.map(owner => this.newSafeOwner(owner.accountId));
    return Promise.all(ownerEntities);
  }

  async safeOwners(): Promise<BlockchainAddress[]> {
    try {
      if (this.safeAddress.network === 'near') {
        // console.log('starting astrodao fetch');
        return await this.astroDaoOwners();
      }
      // console.log('starting gnosis safe fetch');
      return await this.gnosisSafeOwners();
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

  private async gnosisSafePolicy() {
    const { data } = await this.getGnosisSafeInfo();
    const { owners, threshold, version } = data;
    return {
      policy: {
        owners: owners.length,
        threshold,
      },
      version,
    };
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

  private async astroDaoSafePolicy() {
    const { data } = await this.getAstroDaoSafeInfo();
    const { policy, daoVersion, councilSeats } = data;
    const councilRole = policy.roles.find(r => r.name === 'council');

    const configVotePolicy = this.isValidCouncilRole(councilRole, councilSeats)
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
  }

  safeInfo() {
    try {
      if (this.safeAddress.network === 'near') {
        return this.astroDaoSafePolicy();
      }
      return this.gnosisSafePolicy();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn('error message: ', error.message);
      }
      this.logger.error('unexpected error: ', error);
      throw error;
    }
  }
}

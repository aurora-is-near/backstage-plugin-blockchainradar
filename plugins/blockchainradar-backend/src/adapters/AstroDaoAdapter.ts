import {
  ContractStateSpec,
  MultisigSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { PolicyAdapter } from './PolicyAdapter';
import { AstroDaoClient } from '../lib/AstroDaoClient';

export class AstroDaoAdapter extends PolicyAdapter {
  public async fetchMultisigSpec(
    address: string,
    stateSpec: ContractStateSpec | undefined,
  ): Promise<MultisigSpec | undefined> {
    if (stateSpec && stateSpec.methods.get_policy) {
      const nearPolicy: AstroDaoConfig = JSON.parse(
        stateSpec.methods.get_policy,
      );
      const { roles } = nearPolicy;
      const councilRole = roles.find(role => role.name === 'council');
      const owners =
        councilRole && typeof councilRole.kind !== 'string'
          ? councilRole.kind.Group.length
          : 0;
      if (this.isValidCouncilRole(councilRole) && owners) {
        const client = new AstroDaoClient(this.logger);
        return {
          policy: {
            owners,
            threshold: this.calculateThreshold(
              owners,
              councilRole.vote_policy.config || nearPolicy.default_vote_policy,
            ),
          },
          version: await client.safeVersion(address),
          fetchDate: new Date().getTime(),
        };
      }
    }
    return undefined;
  }

  public async fetchMultisigOwners(
    _address: string,
    stateSpec: ContractStateSpec | undefined,
  ) {
    if (stateSpec && stateSpec.methods.get_policy) {
      const nearPolicy: AstroDaoConfig = JSON.parse(
        stateSpec.methods.get_policy,
      );
      const { roles } = nearPolicy;
      const councilRole = roles.find(role => role.name === 'council');
      const owners =
        councilRole && typeof councilRole.kind !== 'string'
          ? councilRole.kind.Group
          : [];
      return { owners, fetchDate: new Date().getTime() };
    }
    return undefined;
  }

  private isValidCouncilRole(
    councilRole: AstroDaoRole | undefined,
  ): councilRole is AstroDaoRole {
    if (!councilRole) {
      throw new Error('No council role found');
    }

    if (councilRole.vote_policy) {
      const allPolicies = Object.entries(councilRole.vote_policy).map(
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

  private calculateThreshold(seats: number, policy: AstroDaoVotePolicy) {
    const { threshold, weight_kind } = policy;
    const [num, denom] = threshold;

    if (weight_kind !== 'RoleWeight')
      throw new Error('TokenWeight not implemented');

    return Math.min(Math.floor((num * seats) / denom) + 1, seats);
  }
}

type AstroDaoConfig = {
  roles: AstroDaoRole[];
  default_vote_policy: AstroDaoVotePolicy;
};

type AstroDaoRole = {
  name: string;
  kind: string | { Group: string[] };
  permissions: string[];
  vote_policy: {
    [capability: string]: AstroDaoVotePolicy;
  };
};

type AstroDaoVotePolicy = {
  weight_kind: string;
  quorum: string;
  threshold: number[];
};

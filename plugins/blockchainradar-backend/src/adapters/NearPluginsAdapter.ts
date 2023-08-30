import {
  ContractStateSpec,
  RbacSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { RoleGroupAdapter } from './RoleGroupAdapter';

export class NearPluginsAdapter extends RoleGroupAdapter {
  public async fetchRbacSpec(
    address: string,
    stateSpec: ContractStateSpec,
  ): Promise<RbacSpec | undefined> {
    if (stateSpec.methods.acl_get_permissioned_accounts) {
      const nearPluginsACLConfig: NearPluginsAclConfig = JSON.parse(
        stateSpec.methods.acl_get_permissioned_accounts,
      );
      const roles = Object.entries(nearPluginsACLConfig.roles);
      return {
        roles: roles.map(([roleName, roleConfig]) => ({
          id: roleName,
          roleName,
          admin: 'super_admins',
          adminOf: [],
          members: roleConfig.grantees,
        })),
        membership: roles.map(([roleName, _]) => ({
          role: roleName,
          contract: address,
        })),
        fetchDate: new Date().getTime(),
      };
    }
    return undefined;
  }
}

type NearPluginsAclConfig = {
  super_admins: string[];
  roles: Record<string, { admins: string[]; grantees: string[] }>;
};

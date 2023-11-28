import {
  ContractStateSpec,
  RbacSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { RoleGroupAdapter } from './RoleGroupAdapter';

const SUPER_ADMIN = 'super_admins';
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
      const superAdmins = nearPluginsACLConfig.super_admins;
      return {
        roles: [
          {
            id: SUPER_ADMIN,
            roleName: SUPER_ADMIN,
            admin: SUPER_ADMIN,
            adminOf: roles.map(([roleName]) => roleName),
            members: superAdmins,
          },
        ].concat(
          roles.map(([roleName, roleConfig]) => ({
            id: roleName,
            roleName,
            admin: SUPER_ADMIN,
            adminOf: [],
            members: roleConfig.grantees,
          })),
        ),
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

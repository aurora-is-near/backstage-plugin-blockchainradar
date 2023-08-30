import {
  ContractStateSpec,
  RbacSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { RoleGroupAdapter } from './RoleGroupAdapter';
import { OpenZeppelinClient } from '../lib/OpenZeppelinClient';

export class OpenZeppelinAdapter extends RoleGroupAdapter {
  public async fetchRbacSpec(
    address: string,
    stateSpec: ContractStateSpec,
  ): Promise<RbacSpec | undefined> {
    const client = new OpenZeppelinClient(this.network, this.logger);
    const parsedRoles = await client.getContractAccessControl(address);
    const stateRoles = Object.entries(stateSpec.methods);

    if (parsedRoles && stateRoles.length > 0) {
      const roles = parsedRoles.map(parsedRole => {
        const role = stateRoles.find(([, roleId]) => roleId === parsedRole.id);
        if (role) {
          const [roleName] = role;
          return { ...parsedRole, roleName };
        }
        return parsedRole;
      }, []);
      const membership = await client.getAccountRoles(address);
      return {
        roles,
        membership,
        fetchDate: new Date().getTime(),
      };
    }
    return undefined;
  }
}

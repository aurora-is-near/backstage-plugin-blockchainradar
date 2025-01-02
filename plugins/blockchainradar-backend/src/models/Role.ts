import { Entity } from '@backstage/catalog-model';
import { Address } from './Address';
import { base58EncodeSha256 } from '../lib/utils';

export class Role extends Address {
  roleId: string;
  roleName?: string;
  admin?: string;
  adminOf?: string[];
  members?: string[];

  constructor(
    network: string,
    networkType: string,
    address: string,
    roleId: string,
  ) {
    super(network, networkType, address, 'role-group');
    this.roleId = roleId;
  }

  getEntityName(): string {
    const name = [
      this.network,
      this.networkType,
      this.address,
      this.roleId,
    ].join('-');
    if (name.length > 63) return base58EncodeSha256(name);

    return name;
  }

  getEntityType(): string {
    return 'role-group';
  }

  toEntity(): Entity {
    const model = super.toEntity();
    return {
      ...model,
      kind: 'API',
      metadata: {
        ...model.metadata,
        title: `${model.metadata.title} role-group ${this.roleName}`,
      },
      spec: {
        ...model.spec,
        type: 'role-group',
        definition: JSON.stringify({
          id: 'string',
          name: 'string',
          admin: 'string',
          adminOf: 'string[]',
          members: 'string[]',
        }),
        lifecycle: 'production',
        roleId: this.roleId,
        roleName: this.roleName,
        admin: this.admin,
        adminOf: this.adminOf,
        members: this.members,
      },
    };
  }
}

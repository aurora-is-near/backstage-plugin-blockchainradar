import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import * as crypto from 'crypto';
import * as bs58 from 'bs58';

import { BlockchainProcessor } from '../processors/BlockchainProcessor';
import { BlockchainAddress } from './BlockchainAddress';

function base58EncodeSha256(str: string): string {
  const hash = crypto.createHash('sha256').update(str).digest();
  return bs58.encode(hash);
}

const ROLE = 'role-group';

export class RoleGroup extends BlockchainAddress {
  roleId: string;
  roleName?: string;
  admin?: string;
  adminOf?: string[];
  members?: string[];

  constructor(
    processor: BlockchainProcessor,
    parent: Entity,
    network: string,
    networkType: string,
    address: string,
    roleId: string,
  ) {
    super(processor, parent, ROLE, network, networkType, address);
    this.roleId = roleId;
    // this is preferred as an identifier since its supposed to be unique
    // and is usually short than the ID
    // this.stub = true; // RoleGroups are discovered on contract state
  }

  entityRef(): string {
    return stringifyEntityRef({
      kind: 'API',
      namespace: this.entityNamespace(),
      name: this.entityName(),
    });
  }

  entityName() {
    const name = [this.network, this.address, this.roleId].join('-');
    if (name.length > 63) return base58EncodeSha256(name);

    return name;
  }

  entitySpec() {
    return {
      ...super.entitySpec(),
      definition: JSON.stringify({
        id: 'string',
        name: 'string',
        admin: 'string',
        adminOf: 'string[]',
        members: 'string[]',
      }),
      // although type is set in parent class, role groups are not addresses
      type: ROLE,
      roleId: this.roleId,
      roleName: this.roleName,
      admin: this.admin,
      adminOf: this.adminOf,
      members: this.members,
    };
  }

  // TODO highlight multisigs somehow
  entityTitle() {
    return `${super.entityTitle()} ${this.roleName}`;
  }

  entityMetadata() {
    const tags = ['role-group', this.network];
    if (this.stub) tags.push('stub');
    return {
      ...super.entityMetadata(),
      description: `${this.address} (${this.role})`,
      tags,
    };
  }

  toEntity(): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: this.entityMetadata(),
      spec: this.entitySpec(),
    };
  }
}

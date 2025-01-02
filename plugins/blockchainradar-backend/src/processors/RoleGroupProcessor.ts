import {
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import {
  Entity,
  RELATION_DEPENDS_ON,
  RELATION_HAS_MEMBER,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  RoleGroupEntity,
  isRoleGroup,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { BlockchainProcessor } from './BlockchainProcessor';
import { Contract } from '../models/Contract';
import { Address } from '../models/Address';
import { Role } from '../models/Role';
import { AdapterFactory } from '../adapters/AdapterFactory';

export class RoleGroupProcessor extends BlockchainProcessor {
  async validateEntityKind(entity: Entity): Promise<boolean> {
    return isRoleGroup(entity);
  }

  async postProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (isRoleGroup(entity)) {
      return this.processRoleGroup(entity, location, emit);
    }
    return entity;
  }

  async processRoleGroup(
    entity: RoleGroupEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const { network, networkType, address, roleId } = entity.spec;
    if (entity.spec.admin && entity.spec.admin !== roleId) {
      const roleGroup = new Role(network, networkType, address, roleId);
      this.logger.debug(`RoleGroup admin (${entity.spec.roleName}): ${roleId}`);
      const roleEntity = roleGroup.toEntity();
      roleEntity.spec = {
        ...roleEntity.spec,
        owner: this.ownerSpec(entity),
        system: this.systemSpec(entity),
      };
      this.emitRelationship(emit, RELATION_DEPENDS_ON, entity, roleEntity);
    }
    if (entity.spec.members) {
      const adapter = AdapterFactory.adapter(this, network, networkType);
      for (const addr of entity.spec.members.map(
        a => new Address(network, networkType, a, 'member'),
      )) {
        const isContract = await adapter.isContract(addr.address);
        const target = isContract ? Contract.from(addr) : addr;
        const addressEntity = await this.stubOrFind(target);

        this.emitRelationship(emit, RELATION_HAS_MEMBER, entity, addressEntity);
        if (target.stub) {
          this.logger.debug(
            `RoleGroup member (${entity.spec.roleName}): ${addr.address}`,
          );
          addressEntity.spec = {
            ...addressEntity.spec,
            owner: this.ownerSpec(entity),
            system: this.systemSpec(entity),
          };

          emit(processingResult.entity(location, addressEntity));
        }
      }
    }
    return entity;
  }
}

import {
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  RoleGroupEntity,
  isRoleGroup,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { RoleGroup } from '../entities/RoleGroup';
import { BlockchainFactory } from '../lib/BlockchainFactory';
import { BlockchainProcessor } from './BlockchainProcessor';

export class RoleGroupProcessor extends BlockchainProcessor {
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
      const roleGroup = new RoleGroup(
        this,
        entity,
        network,
        networkType,
        address,
        roleId,
      );
      roleGroup.emitDependencyOf(emit);
    }
    if (entity.spec.members) {
      for (const addr of entity.spec.members) {
        const blockchainAddress = await BlockchainFactory.contractOrAccount(
          this,
          entity,
          'member',
          addr,
          network,
          networkType,
        );
        await blockchainAddress.stubOrFind(this.catalogClient);
        blockchainAddress.emitMemberOf(emit);
        if (blockchainAddress.stub) {
          emit(processingResult.entity(location, blockchainAddress.toEntity()));
        }
      }
    }
    return entity;
  }
}

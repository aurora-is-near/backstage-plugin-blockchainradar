import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-backend';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity, isApiEntity } from '@backstage/catalog-model';
import { BlockchainFactory } from '../lib/BlockchainFactory';
import { BlockchainProcessor } from './BlockchainProcessor';
import { ContractDeploymentEntity } from '../lib/types';

interface ISputnikRole {
  name: string;
  kind: string | Record<string, string[]>;
}

export class SputnikProcessor extends BlockchainProcessor {
  private isSputnikDeployment(
    entity: Entity,
  ): entity is ContractDeploymentEntity {
    return (
      isApiEntity(entity) &&
      entity.spec.type === 'contract-deployment' &&
      !!entity.metadata.name.match(/\.sputnik-dao\.near$/)
    );
  }

  async postProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (this.isSputnikDeployment(entity)) {
      const deployment = entity.spec.deployment;
      const policy = deployment?.state?.methods.get_policy;
      if (policy) {
        try {
          const parsedPolicy = JSON.parse(policy) as Record<string, any>;
          const roles = parsedPolicy.roles as ISputnikRole[];
          for (const role of roles) {
            if (typeof role.kind !== 'string') {
              const roleAddresses = role.kind.Group;
              for (const addr of roleAddresses) {
                const roleAddress = await BlockchainFactory.fromEntity(
                  this,
                  entity,
                  role.name,
                  addr,
                );
                await this.emitActsOn(roleAddress, location, emit, [
                  'sputnik-member',
                ]);
              }
            }
          }
        } catch (e) {
          emit(
            processingResult.generalError(
              location,
              "can't parse Sputnik policy",
            ),
          );
          this.logger.error(e);
          this.logger.debug(policy);
        }
      }
    }
    return entity;
  }
}

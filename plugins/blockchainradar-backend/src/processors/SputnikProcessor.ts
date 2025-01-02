import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  Entity,
  RELATION_API_CONSUMED_BY,
  isApiEntity,
} from '@backstage/catalog-model';
import { ContractDeploymentEntity } from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { Contract } from '../models/Contract';
import { Address } from '../models/Address';

const SPUTNIK_ROLE_RUN_ID = 'sputnik-role-fetch';

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
              const roleAddresses = role.kind.Group.map(address =>
                Address.from({ ...entity.spec, address }),
              );
              for (const address of roleAddresses) {
                const adapter = AdapterFactory.adapter(
                  this,
                  entity.spec.network,
                  entity.spec.networkType,
                );
                let isContract = false;
                await this.runExclusive(
                  SPUTNIK_ROLE_RUN_ID,
                  address.address,
                  async _logger => {
                    try {
                      isContract = await adapter.isContract(address.address);
                    } catch (error) {
                      this.logger.warn(
                        `unable to fetch user signer for ${address}`,
                      );
                    }
                  },
                );
                const target = isContract ? Contract.from(address) : address;
                const addressEntity = await this.stubOrFind(target);
                addressEntity.spec = {
                  ...addressEntity.spec,
                  owner: this.ownerSpec(entity),
                };
                this.appendTags(addressEntity, 'sputnik-member');
                this.emitRelationship(
                  emit,
                  RELATION_API_CONSUMED_BY,
                  entity,
                  addressEntity,
                );
                if (target.stub) {
                  emit(processingResult.entity(location, addressEntity));
                }
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

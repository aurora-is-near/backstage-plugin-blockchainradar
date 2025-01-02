import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import {
  Entity,
  RELATION_API_PROVIDED_BY,
  RELATION_OWNED_BY,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  MultisigComponentEntity,
  MultisigDeploymentEntity,
  isMultisigComponent,
  isMultisigDeployment,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { OwnerSpec } from '../lib/types';
import { Multisig } from '../models/Multisig';
import { Address } from '../models/Address';
import { AdapterFactory } from '../adapters/AdapterFactory';

const MULTISIG_OWNERS_RUN_ID = 'multisig-owners-fetch';

export class MultisigProcessor extends BlockchainProcessor {
  async postProcessEntity?(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (isMultisigComponent(entity)) {
      return this.processContractComponent(entity, location, emit);
    } else if (isMultisigDeployment(entity)) {
      return this.processMultisigDeployment(entity, location, emit, cache);
    }
    return entity;
  }

  async processContractComponent(
    entity: MultisigComponentEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    if (entity.spec.deployedAt) {
      const contracts = entity.spec.deployedAt.map(ref =>
        Multisig.fromRef(ref),
      );
      for (const contract of contracts) {
        this.appendLink(entity, contract.toLink());
        const contractEntity = contract.toEntity();
        contractEntity.spec = {
          ...contractEntity.spec,
          owner: this.ownerSpec(entity),
          system: this.systemSpec(entity),
        };

        emit(processingResult.entity(location, contractEntity));
        this.emitRelationship(
          emit,
          RELATION_API_PROVIDED_BY,
          entity,
          contractEntity,
        );
      }
    }
    return entity;
  }

  async processMultisigDeployment(
    entity: MultisigDeploymentEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ) {
    const multisig = Multisig.from(entity.spec);
    const policyAdapter = AdapterFactory.policyAdapter(
      this,
      multisig.network,
      multisig.networkType,
    );

    let ownerSpec = await this.fetchCachedSpec<OwnerSpec>(
      cache,
      MULTISIG_OWNERS_RUN_ID,
    );
    if (!this.isCacheUpToDate(ownerSpec)) {
      await this.runExclusive(
        MULTISIG_OWNERS_RUN_ID,
        multisig.address,
        async logger => {
          try {
            this.logger.debug(`${entity.metadata.name} fetching safe owners`);
            ownerSpec = await policyAdapter.fetchMultisigOwners(
              entity.spec.address,
              entity.spec.deployment?.state,
            );
            if (ownerSpec) {
              await this.setScopedCachedSpec(
                MULTISIG_OWNERS_RUN_ID,
                cache,
                ownerSpec,
              );
            }
          } catch (error) {
            logger.error(error);
          }
        },
      );
    } else {
      await this.setScopedCachedSpec(MULTISIG_OWNERS_RUN_ID, cache, ownerSpec!);
    }

    if (ownerSpec?.owners) {
      const multisigOwners = ownerSpec.owners.map(
        address =>
          new Address(
            multisig.network,
            multisig.networkType,
            address,
            'signer',
          ),
      );
      this.logger.debug(
        `${entity.metadata.name} owners: ${multisigOwners.length}`,
      );
      if (multisigOwners.length > 0) {
        this.appendTags(entity, 'multisig');
      } else {
        this.appendTags(entity, 'non-multisig');
      }

      let hasUnknown = false;
      for (const target of multisigOwners) {
        const addressEntity = await this.stubOrFind(target);
        this.emitRelationship(emit, RELATION_OWNED_BY, entity, addressEntity);

        if (target.stub) {
          addressEntity.spec = {
            ...addressEntity.spec,
            interactions: {
              ...(typeof addressEntity.spec?.interactions === 'object' &&
                addressEntity.spec.interactions),
              [multisig.getEntityName()]: 'signer',
            },
            owner: this.ownerSpec(entity),
          };
          hasUnknown = true;
          emit(processingResult.entity(location, addressEntity));
        }
      }

      const tags = multisig.getEntityTags();
      const hasAllowUnknown = tags
        ? tags.some(tag => tag === 'allow-unknown')
        : false;
      if (hasUnknown && !hasAllowUnknown) {
        this.appendTags(entity, 'has-unknown');
      }
    }

    let multisigSpec = entity.spec.multisig;
    if (!this.isCacheUpToDate(multisigSpec)) {
      await this.runExclusive(
        'multisig-info-fetch',
        multisig.address,
        async logger => {
          try {
            multisigSpec = await policyAdapter.fetchMultisigSpec(
              entity.spec.address,
              entity.spec.deployment?.state,
            );
          } catch (error) {
            logger.error(error);
          }
        },
      );
    }
    entity.spec.multisig = multisigSpec;
    return entity;
  }
}

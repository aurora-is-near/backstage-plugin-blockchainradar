import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import {
  DEFAULT_NAMESPACE,
  Entity,
  RELATION_API_CONSUMED_BY,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  BlockchainAddressEntity,
  ContractDeploymentEntity,
  NearKeysSpec,
  isContractDeployment,
  isRoleGroup,
  isFullAccessKey,
  isBlockchainAddress,
  isSigner,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { NearAdapter } from '../adapters/NearAdapter';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { NearAccessKey } from '../models/NearAccessKey';

export class NearKeysProcessor extends BlockchainProcessor {
  private async fetchNearKeys(
    entity: BlockchainAddressEntity,
    cache: CatalogProcessorCache,
  ) {
    let keysSpec = await this.fetchCachedSpec<NearKeysSpec>(cache);
    if (!this.isCacheUpToDate(keysSpec)) {
      await this.runExclusive(
        'near-keys-fetch',
        entity.spec.address,
        async logger => {
          const rawKeys = await AdapterFactory.adapter<NearAdapter>(
            this,
            entity.spec.network,
            entity.spec.networkType,
          ).keys(entity.spec.address);
          logger.debug(`fetched ${rawKeys.length} keys`);
          keysSpec = { fetchDate: Date.now(), keys: {} };

          for (const key of rawKeys)
            keysSpec.keys[key.public_key] = JSON.stringify(
              key.access_key.permission,
            );

          this.setCachedSpec(cache, keysSpec);
        },
      );
    }
    return keysSpec;
  }

  private isAcceptableNearAddress(
    entity: Entity,
  ): entity is BlockchainAddressEntity {
    return (
      isBlockchainAddress(entity) &&
      entity.spec.network === 'near' &&
      AdapterFactory.adapter(
        this,
        entity.spec.network,
        entity.spec.networkType,
      ).isValidAddress(entity.spec.address)
    );
  }

  async postProcessEntity?(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (this.isAcceptableNearAddress(entity) && !isRoleGroup(entity)) {
      if (isContractDeployment(entity)) {
        await this.processContract(entity, location, emit, cache);
      } else if (isSigner(entity)) {
        return this.processNonContract(entity, location, emit, cache);
      }
    }
    return entity;
  }

  private async processContract(
    entity: ContractDeploymentEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ) {
    const keysSpec = await this.fetchNearKeys(entity, cache);
    if (!keysSpec) return;

    entity.spec.nearKeys = keysSpec;
    if (Object.keys(keysSpec.keys).length === 0)
      this.appendTags(entity, 'locked');

    for (const [publicKey] of Object.entries(keysSpec.keys)) {
      const nearKey = new NearAccessKey(publicKey);
      const keyEntity = await this.stubOrFind(nearKey);
      keyEntity.spec = {
        ...keyEntity.spec,
        owner: this.ownerSpec(entity),
      };
      this.emitRelationship(emit, RELATION_API_CONSUMED_BY, entity, keyEntity);
      if (nearKey.stub) {
        emit(processingResult.entity(location, keyEntity));
      }
    }
  }

  private async processNonContract(
    entity: BlockchainAddressEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ) {
    const keysSpec = await this.fetchNearKeys(entity, cache);
    if (keysSpec) {
      entity.spec.nearKeys = keysSpec;
      if (Object.keys(keysSpec.keys).length === 0)
        this.appendTags(entity, 'locked');

      for (const [publicKey, perms] of Object.entries(keysSpec.keys)) {
        if (!isFullAccessKey(perms)) continue;

        if (entity.metadata.namespace === DEFAULT_NAMESPACE) {
          const owner = await this.catalogClient.getEntityByRef(
            entity.spec.owner,
          );
          const nearKey = new NearAccessKey(publicKey);
          const keyEntity = nearKey.toEntity();
          keyEntity.spec = {
            ...keyEntity.spec,
            owner: this.ownerSpec(owner || entity),
          };
          const isDeprecated = entity.metadata.tags?.includes('deprecated');
          if (isDeprecated) {
            this.appendTags(keyEntity, 'deprecated');
          }
          emit(processingResult.entity(location, keyEntity));
          this.emitRelationship(
            emit,
            RELATION_API_CONSUMED_BY,
            entity,
            keyEntity,
          );
        } else {
          const nearKey = new NearAccessKey(publicKey);
          const keyEntity = await this.stubOrFind(nearKey);
          keyEntity.spec = {
            ...keyEntity.spec,
            owner: this.ownerSpec(entity),
          };
          this.emitRelationship(
            emit,
            RELATION_API_CONSUMED_BY,
            entity,
            keyEntity,
          );
          if (nearKey.stub) {
            emit(processingResult.entity(location, keyEntity));
          }
        }
      }
    }

    return entity;
  }
}

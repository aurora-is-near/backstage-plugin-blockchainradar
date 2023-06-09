import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-backend';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';

import { BlockchainFactory } from '../lib/BlockchainFactory';
import { BlockchainProcessor } from './BlockchainProcessor';
import { NearKey } from '../entities/NearKey';
import {
  isFullAccessKey,
  NearKeysSpec,
} from '@aurora-is-near/backstage-plugin-blockchain-common';
import { NearAdapter } from '../adapters/NearAdapter';
import {
  isContractDeployment,
  isBlockchainUser,
  isSigner,
  BlockchainAddressEntity,
  isValidBlockchainAddress,
  ContractDeploymentEntity,
  BlockchainUser,
} from '../lib/types';
import { AdapterFactory } from '../adapters/AdapterFactory';

export class NearKeysProcessor extends BlockchainProcessor {
  private async fetchNearKeys(
    entity: BlockchainAddressEntity,
    cache: CatalogProcessorCache,
  ) {
    const blockchainAddress = await BlockchainFactory.fromEntity(this, entity);
    let keysSpec = await this.fetchCachedSpec<NearKeysSpec>(cache);
    if (!this.isCacheUpToDate(keysSpec)) {
      await this.runExclusive(
        'near-keys-fetch',
        blockchainAddress.address,
        async logger => {
          const rawKeys = await (blockchainAddress.adapter as NearAdapter).keys(
            blockchainAddress.address,
          );
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
      isValidBlockchainAddress(
        entity,
        AdapterFactory.adapter(this, 'near', 'default'),
      ) && entity.spec.network === 'near'
    );
  }

  async postProcessEntity?(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (isBlockchainUser(entity)) {
      this.processUserEntity(entity, emit, location);
    } else {
      if (this.isAcceptableNearAddress(entity)) {
        if (isContractDeployment(entity)) {
          await this.processContract(entity, cache, emit, location);
        } else await this.processNonContract(entity, cache, emit, location);
      }
    }
    return entity;
  }

  private processUserEntity(
    entity: BlockchainUser,
    emit: CatalogProcessorEmit,
    location: LocationSpec,
  ) {
    if (entity.spec.keys) {
      const deprecated = entity.spec.deprecated || [];
      const nearKeys = entity.spec.keys.map(
        (k: string) => new NearKey(this, entity, k),
      );
      // TODO: Filter after deserializing to avoid leaking imp details
      const deprecatedNearKeys = deprecated
        .filter(ref => ref.includes('ed25519'))
        .map((k: string) => new NearKey(this, entity, k))
        .reduce((acc, s) => ({ ...acc, [s.publicKey]: true }), {});
      const isRetired = entity.metadata.tags?.includes('retired');
      for (const nearKey of nearKeys) {
        const key = nearKey.toEntity();
        if (nearKey.publicKey in deprecatedNearKeys || isRetired) {
          this.appendTags(key, 'deprecated');
        }
        emit(processingResult.entity(location, key));
        nearKey.emitOwnedBy(emit);
      }
    }
  }

  private async processContract(
    entity: ContractDeploymentEntity,
    cache: CatalogProcessorCache,
    emit: CatalogProcessorEmit,
    location: LocationSpec,
  ) {
    const keysSpec = await this.fetchNearKeys(entity, cache);
    if (!keysSpec) return;

    entity.spec.nearKeys = keysSpec;
    if (Object.keys(keysSpec.keys).length === 0)
      this.appendTags(entity, 'locked');

    for (const [publicKey] of Object.entries(keysSpec.keys)) {
      const nearKey = new NearKey(this, entity, publicKey);
      await nearKey.stubOrFind(this.catalogClient);
      if (!isBlockchainUser(nearKey.parent) || nearKey.stub) {
        const key = nearKey.toEntity();
        emit(processingResult.entity(location, key));
      }
      nearKey.emitActsOn(emit, entity);
    }
  }

  private async processNonContract(
    entity: BlockchainAddressEntity,
    cache: CatalogProcessorCache,
    emit: CatalogProcessorEmit,
    location: LocationSpec,
  ) {
    const keysSpec = await this.fetchNearKeys(entity, cache);
    if (!keysSpec) return;

    entity.spec.nearKeys = keysSpec;
    if (Object.keys(keysSpec.keys).length === 0)
      this.appendTags(entity, 'locked');

    for (const [publicKey, perms] of Object.entries(keysSpec.keys)) {
      if (!isFullAccessKey(perms)) continue;

      if (isSigner(entity) && entity.metadata.namespace === 'default') {
        const addr = await BlockchainFactory.fromEntity(this, entity, 'signer');
        const owner = await this.catalogClient.getEntityByRef(
          entity.spec.owner,
        );
        const nearKey = new NearKey(this, owner || addr.parent, publicKey);
        const key = nearKey.toEntity();
        const isDeprecated = addr.parent.metadata.tags?.includes('deprecated');
        if (isDeprecated) {
          this.appendTags(key, 'deprecated');
        }
        emit(processingResult.entity(location, key));
        nearKey.emitActsOn(emit, entity);
      } else {
        const nearKey = new NearKey(this, entity, publicKey);
        await nearKey.stubOrFind(this.catalogClient);
        const key = nearKey.toEntity();
        if (nearKey.stub) {
          emit(processingResult.entity(location, key));
        }
        nearKey.emitActsOn(emit, entity);
      }
    }
  }
}

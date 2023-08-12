import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import {
  SignerEntity,
  isSigner,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { BlockchainProcessor } from './BlockchainProcessor';
import { EvmAdapter } from '../adapters/EvmAdapter';
import { LocationSpec } from '@backstage/plugin-catalog-common';

export class SignerProcessor extends BlockchainProcessor {
  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (isSigner(entity) && entity.spec.network !== 'near') {
      return this.processSigner(entity, cache);
    }
    return entity;
  }

  async processSigner(entity: SignerEntity, cache: CatalogProcessorCache) {
    const evmAdapter = new EvmAdapter(
      this.config,
      entity.spec.network,
      entity.spec.networkType,
    );

    const spec = entity.spec;
    if (!this.isCacheUpToDate(spec)) {
      await this.runExclusive(
        'signer-info-fetch',
        entity.spec.address,
        async _logger => {
          if (entity.spec) {
            try {
              const lastTx = await evmAdapter.fetchLastTransaction(
                entity.spec.address,
              );
              const lastSignatureTimestamp = lastTx?.timeStamp;
              spec.lastSigned = parseInt(lastSignatureTimestamp || '0') * 1000;
              spec.fetchDate = new Date().valueOf();
              this.setCachedSpec(cache, spec);
            } catch (error) {
              _logger.error(error);
            }
          }
        },
      );
    }
    entity.spec = spec;
    return entity;
  }
}

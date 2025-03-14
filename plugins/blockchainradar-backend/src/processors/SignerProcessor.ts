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
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { AdapterFactory } from '../adapters/AdapterFactory';

const SIGNER_INFO_RUN_ID = 'signer-info-fetch';

export class SignerProcessor extends BlockchainProcessor {
  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (isSigner(entity)) {
      return this.processSigner(entity, cache);
    }
    return entity;
  }

  async processSigner(entity: SignerEntity, cache: CatalogProcessorCache) {
    const spec = entity.spec;
    if (!this.isCacheUpToDate(spec)) {
      await this.runExclusiveScoped(
        'explorer',
        SIGNER_INFO_RUN_ID,
        entity.spec.address,
        async _logger => {
          if (entity.spec) {
            try {
              const lastTx = await AdapterFactory.adapter(
                this,
                entity.spec.network,
                entity.spec.networkType,
              ).fetchLastTransaction(entity.spec.address);
              if (lastTx && 'timeStamp' in lastTx) {
                const lastSignatureTimestamp = lastTx?.timeStamp;
                spec.lastSigned =
                  parseInt(lastSignatureTimestamp || '0') * 1000;
              } else if (lastTx && 'block_timestamp' in lastTx) {
                const lastSignatureTimestamp = lastTx?.block_timestamp;
                spec.lastSigned =
                  parseInt(lastSignatureTimestamp || '0') / 1_000_000;
              }
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

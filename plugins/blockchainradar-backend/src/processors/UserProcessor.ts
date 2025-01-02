import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity, RELATION_OWNER_OF } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  BlockchainUser,
  isBlockchainUser,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { Address } from '../models/Address';
import { Contract } from '../models/Contract';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { NearAccessKey } from '../models/NearAccessKey';

const USER_SIGNER_RUN_ID = 'user-signer-fetch';

export class UserProcessor extends BlockchainProcessor {
  async validateEntityKind(entity: Entity): Promise<boolean> {
    return isBlockchainUser(entity);
  }

  async postProcessEntity?(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (isBlockchainUser(entity)) {
      return this.processBlockchainUser(entity, location, emit);
    }
    return entity;
  }

  async processBlockchainUser(
    entity: BlockchainUser,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const logger = this.logger.child({ component: 'user-discovery' });
    const isRetired = entity.metadata.tags?.includes('retired');

    if (entity.spec.interactsWith) {
      logger.debug(`${entity.metadata.name} fetching user addresses`);
      const addresses = entity.spec.interactsWith.map(ref =>
        Address.fromRef(ref),
      );

      for (const addr of addresses) {
        // TODO all of this logic needs to be abstracted out to the Adapters
        if (addr.role === 'signer' && addr.network !== 'near') {
          for (const network of ['ethereum', 'aurora']) {
            if (
              !addresses.some(
                a => a.network === network && a.address === addr.address,
              )
            ) {
              logger.debug(
                `no ${network} signer for ${addr.address} found, appending`,
              );
              // a lot of user experience depends on the fact that
              // all signers are directly owned by the User entity
              // hence can't use BlockchainFactory.from* methods
              const newAddr = new Address(
                network,
                addr.networkType,
                addr.address,
                addr.role,
              );
              addresses.push(newAddr);
            }
          }
        }
      }

      const deprecated = entity.spec.deprecated || [];
      const deprecatedSigners = deprecated
        .map(ref => Address.fromRef(ref))
        .filter(addr => addr.role === 'signer')
        .reduce((acc, s) => ({ ...acc, [s.address]: true }), {});

      // Users only need to explicitly define their wallet addresses
      // once (for signer role) - EVM addresses for other chains are emitted
      // automatically
      for (const addr of addresses) {
        const adapter = AdapterFactory.adapter(
          this,
          addr.network,
          addr.networkType,
        );
        let isContract = false;
        await this.runExclusive(
          USER_SIGNER_RUN_ID,
          addr.address,
          async _logger => {
            try {
              isContract = await adapter.isContract(addr.address);
            } catch (error) {
              this.logger.warn(
                `unable to fetch user signer for ${addr.address}`,
              );
            }
          },
        );
        const target = isContract ? Contract.from(addr) : addr;
        const addressEntity = target.toEntity();
        addressEntity.spec = {
          ...addressEntity.spec,
          owner: this.ownerSpec(entity),
        };
        if (addr.address in deprecatedSigners || isRetired) {
          this.appendTags(addressEntity, 'deprecated');
        }

        emit(processingResult.entity(location, addressEntity));
        this.emitRelationship(emit, RELATION_OWNER_OF, entity, addressEntity);
      }
    }

    if (entity.spec.keys) {
      const deprecated = entity.spec.deprecated || [];
      const deprecatedNearKeys = deprecated
        .filter(key => NearAccessKey.isValid(key))
        .map(key => new NearAccessKey(key))
        .reduce((acc, s) => ({ ...acc, [s.publicKey]: true }), {});
      const nearKeys = entity.spec.keys.map(k => new NearAccessKey(k));
      for (const nearKey of nearKeys) {
        const keyEntity = nearKey.toEntity();
        keyEntity.spec = {
          ...keyEntity.spec,
          owner: this.ownerSpec(entity),
        };
        if (nearKey.publicKey in deprecatedNearKeys || isRetired) {
          this.appendTags(keyEntity, 'deprecated');
        }
        emit(processingResult.entity(location, keyEntity));
        this.emitRelationship(emit, RELATION_OWNER_OF, entity, keyEntity);
      }
    }
    return entity;
  }
}

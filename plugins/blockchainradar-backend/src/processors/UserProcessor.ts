import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  BlockchainUser,
  isBlockchainUser,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { BlockchainFactory } from '../lib/BlockchainFactory';

export class UserProcessor extends BlockchainProcessor {
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
      const interactsWith = await Promise.all(
        entity.spec.interactsWith.map(addressStr =>
          BlockchainFactory.fromUserSpecifiedAddress(this, addressStr, entity),
        ),
      );
      // Users only need to explicitly define their wallet addresses
      // once (for signer role) - EVM addresses for other chains are emitted
      // automatically
      for (const addr of interactsWith) {
        // TODO all of this logic needs to be abstracted out to the Adapters
        if (addr.role === 'signer' && addr.network !== 'near') {
          for (const network of ['ethereum', 'aurora']) {
            if (
              !interactsWith.some(
                a => a.network === network && a.address === addr.address,
              )
            ) {
              logger.debug(
                `no ${network} signer for ${addr.address} found, appending`,
              );
              // a lot of user experience depends on the fact that
              // all signers are directly owned by the User entity
              // hence can't use BlockchainFactory.from* methods
              const newAddr = await BlockchainFactory.contractOrAccount(
                this,
                entity,
                addr.role,
                addr.address,
                network,
                addr.networkType, // this will not work long term - needs to be refactored with adapters
              );
              interactsWith.push(newAddr);
            }
          }
        }
        emit(processingResult.entity(location, addr.toEntity()));
        addr.emitOwnedBy(emit);
      }
      const deprecated = entity.spec.deprecated || [];
      logger.debug(`${entity.metadata.name} fetching deprecated addresses`);
      const deprecatedSigners = (
        await Promise.all(
          deprecated.map(ref => {
            return BlockchainFactory.fromUserSpecifiedAddress(
              this,
              ref,
              entity,
            );
          }),
        )
      ).filter(addr => addr.role === 'signer');
      const deprecatedAddresses = deprecatedSigners.map(s => s.address);
      const activeSigners = interactsWith.filter(
        signer => !deprecatedAddresses.includes(signer.address),
      );
      for (const addr of activeSigners) {
        const signer = addr.toEntity();
        if (isRetired) {
          this.appendTags(signer, 'deprecated');
        }
        emit(processingResult.entity(location, signer));
        addr.emitOwnedBy(emit);
      }
      for (const addr of deprecatedSigners) {
        const signer = addr.toEntity();
        this.appendTags(signer, 'deprecated');
        emit(processingResult.entity(location, signer));
        addr.emitOwnedBy(emit);
      }
    }
    return entity;
  }
}

import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  BlockchainGroup,
  isBlockchainGroup,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { BlockchainFactory } from '../lib/BlockchainFactory';

export class GroupProcessor extends BlockchainProcessor {
  async postProcessEntity?(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (isBlockchainGroup(entity)) {
      return this.processBlockchainGroup(entity, location, emit);
    }
    return entity;
  }

  async processBlockchainGroup(
    entity: BlockchainGroup,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const logger = this.logger.child({ component: 'group-discovery' });
    if (entity.spec.interactsWith) {
      logger.debug(`${entity.metadata.name} fetching group addresses`);
      await Promise.all(
        entity.spec.interactsWith.map(async address => {
          const addr = await BlockchainFactory.fromUserSpecifiedAddress(
            this,
            address.name,
            entity,
          );
          if (addr.role === 'signer' && addr.network !== 'near') {
            // Users only need to explicitly define their wallet addresses
            // once (for signer role) - EVM addresses for other chains are emitted
            // automatically
            for (const network of ['ethereum', 'aurora']) {
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
              const signer = newAddr.toEntity();
              signer.metadata.description = signer.metadata.description?.concat(
                ` - ${address.description}`,
              );
              emit(processingResult.entity(location, signer));
              addr.emitOwnedBy(emit);
            }
          } else if (addr.network === 'near') {
            const signer = addr.toEntity();
            signer.metadata.description = signer.metadata.description?.concat(
              ` - ${address.description}`,
            );
            emit(processingResult.entity(location, signer));
            addr.emitOwnedBy(emit);
          }
        }),
      );
    }
    return entity;
  }
}

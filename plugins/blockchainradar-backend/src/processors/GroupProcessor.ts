import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity, RELATION_OWNER_OF } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  BlockchainGroup,
  isBlockchainGroup,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { Address } from '../models/Address';
import { AdapterFactory } from '../adapters/AdapterFactory';

const GROUP_SIGNER_RUN_ID = 'group-signer-fetch';

export class GroupProcessor extends BlockchainProcessor {
  async validateEntityKind(entity: Entity): Promise<boolean> {
    return isBlockchainGroup(entity);
  }

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
      logger.debug(`${entity.metadata.name} fetching user addresses`);
      const addresses = entity.spec.interactsWith.map(ref =>
        Address.fromRef(ref.name),
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
          GROUP_SIGNER_RUN_ID,
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
        if (!isContract) {
          const newEntity = addr.toEntity();
          newEntity.spec = {
            ...newEntity.spec,
            owner: this.ownerSpec(entity),
          };

          emit(processingResult.entity(location, newEntity));
          this.emitRelationship(emit, RELATION_OWNER_OF, entity, newEntity);
        }
      }
    }
    return entity;
  }
}

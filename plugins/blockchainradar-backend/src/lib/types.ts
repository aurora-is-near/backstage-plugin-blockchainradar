import { CatalogEnvironment } from '@backstage/plugin-catalog-backend';
import { Entity } from '@backstage/catalog-model';
import {
  BlockchainAddressEntity,
  CacheableSpec,
  isBlockchainAddress,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { PluginEndpointDiscovery } from '@backstage/backend-common';
import { BlockchainAdapter } from '../adapters/BlockchainAdapter';

export type PluginEnvironment = CatalogEnvironment & {
  discovery: PluginEndpointDiscovery;
};

export type OwnerSpec = CacheableSpec & {
  owners: string[];
};

export function isValidBlockchainAddress(
  entity: Entity,
  adapter: BlockchainAdapter,
): entity is BlockchainAddressEntity {
  return (
    isBlockchainAddress(entity) && adapter.isValidAddress(entity.spec.address)
  );
}

/* eslint-disable @backstage/no-undeclared-imports */
import { CatalogEnvironment } from '@backstage/plugin-catalog-backend';
import { Entity } from '@backstage/catalog-model';
import {
  BlockchainAddressEntity,
  isBlockchainAddress,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { PluginEndpointDiscovery } from '@backstage/backend-common';
import { BlockchainAdapter } from '../adapters/BlockchainAdapter';

export type PluginEnvironment = CatalogEnvironment & {
  discovery: PluginEndpointDiscovery;
};

export function isValidBlockchainAddress(
  entity: Entity,
  adapter: BlockchainAdapter,
): entity is BlockchainAddressEntity {
  return (
    isBlockchainAddress(entity) && adapter.isValidAddress(entity.spec.address)
  );
}

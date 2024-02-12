import { CatalogEnvironment } from '@backstage/plugin-catalog-backend';
import { CacheableSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { PluginEndpointDiscovery } from '@backstage/backend-common';

export type PluginEnvironment = CatalogEnvironment & {
  discovery: PluginEndpointDiscovery;
};

export type OwnerSpec = CacheableSpec & {
  owners: string[];
};

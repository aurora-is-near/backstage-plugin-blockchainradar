import { CatalogEnvironment } from '@backstage/plugin-catalog-backend';
import { CacheableSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import {
  DiscoveryService,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';

/**
 * @deprecated
 */
export type PluginEnvironment = CatalogEnvironment & {
  discovery: DiscoveryService;
};

export type BlockchainradarEnvironment = {
  config: RootConfigService;
  discovery: DiscoveryService;
  logger: LoggerService;
};

export type OwnerSpec = CacheableSpec & {
  owners: string[];
};

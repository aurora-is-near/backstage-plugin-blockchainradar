import {
  createComponentExtension,
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

/** @public */
export { AboutContent, AboutField } from './components/BlockchainInsightsCard';
export type {
  BlockchainInsightsCardProps,
  AboutContentProps,
  AboutFieldProps,
} from './components/BlockchainInsightsCard';

export const blockchainPlugin = createPlugin({
  id: 'blockchain-catalog',
  routes: {
    catalogPage: rootRouteRef,
  },
});

export const BlockchainIndexPage = blockchainPlugin.provide(
  createRoutableExtension({
    component: () =>
      import('./components/BlockchainIndexPage').then(
        m => m.BlockchainIndexPage,
      ),
    mountPoint: rootRouteRef,
  }),
);
export const CustomCatalogPage = BlockchainIndexPage;

export const BlockchainEntityPage = blockchainPlugin.provide(
  createRoutableExtension({
    component: () =>
      import('./components/BlockchainEntityPage').then(
        m => m.BlockchainEntityPage,
      ),
    mountPoint: rootRouteRef,
  }),
);
export const CustomEntityPage = BlockchainEntityPage;

export const EntityBlockchainContent = blockchainPlugin.provide(
  createComponentExtension({
    name: 'EntityBlockchainContent',
    component: {
      lazy: () =>
        import('./components/BlockchainEntityPage').then(
          m => m.EntityBlockchainContent,
        ),
    },
  }),
);

export const EntityBlockchainInsightsCard = blockchainPlugin.provide(
  createComponentExtension({
    name: 'EntityBlockchainInsightsCard',
    component: {
      lazy: () =>
        import('./components/BlockchainInsightsCard').then(
          m => m.BlockchainInsightsCard,
        ),
    },
  }),
);

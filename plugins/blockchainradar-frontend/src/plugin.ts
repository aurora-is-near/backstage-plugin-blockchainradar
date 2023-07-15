import {
  createComponentExtension,
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

/** @public */
export { AboutContent } from './components/AboutContent';
export { AboutField } from './components/AboutField';
export type { AboutContentProps } from './components/AboutContent';
export type { AboutFieldProps } from './components/AboutField';
export type { BlockchainInsightsCardProps } from './components/BlockchainInsightsCard';

export const blockchainPlugin = createPlugin({
  id: 'blockchain-catalog',
  routes: {
    catalogPage: rootRouteRef,
  },
});

export const BlockchainIndexPage = blockchainPlugin.provide(
  createRoutableExtension({
    name: 'BlockchainIndexPage',
    component: () =>
      import('./components/BlockchainIndexPage').then(
        m => m.BlockchainIndexPage,
      ),
    mountPoint: rootRouteRef,
  }),
);

export const BlockchainEntityPage = blockchainPlugin.provide(
  createRoutableExtension({
    name: 'BlockchainEntityPage',
    component: () =>
      import('./components/BlockchainEntityPage').then(
        m => m.BlockchainEntityPage,
      ),
    mountPoint: rootRouteRef,
  }),
);

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

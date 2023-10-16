import {
  createComponentExtension,
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { catalogIndexRouteRef, rootRouteRef } from './routes';

export const blockchainPlugin = createPlugin({
  id: 'blockchain',
  routes: {
    root: rootRouteRef,
  },
  externalRoutes: {
    catalogIndex: catalogIndexRouteRef,
  },
});

export const BlockchainIndexPage = blockchainPlugin.provide(
  createRoutableExtension({
    name: 'BlockchainIndexPage',
    component: () => import('./components').then(m => m.BlockchainIndexPage),
    mountPoint: rootRouteRef,
  }),
);

export const BlockchainEntityPage = blockchainPlugin.provide(
  createRoutableExtension({
    name: 'BlockchainEntityPage',
    component: () => import('./components').then(m => m.BlockchainEntityPage),
    mountPoint: rootRouteRef,
  }),
);

export const EntityBlockchainContent = blockchainPlugin.provide(
  createComponentExtension({
    name: 'EntityBlockchainContent',
    component: {
      lazy: () => import('./components').then(m => m.EntityBlockchainContent),
    },
  }),
);

export const EntityBlockchainInsightsCard = blockchainPlugin.provide(
  createComponentExtension({
    name: 'EntityBlockchainInsightsCard',
    component: {
      lazy: () =>
        import('./components').then(m => m.EntityBlockchainInsightsCard),
    },
  }),
);

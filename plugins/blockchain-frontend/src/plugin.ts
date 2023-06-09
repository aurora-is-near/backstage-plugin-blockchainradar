import {
  createComponentExtension,
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { BlockchainInsightsCardProps } from './components/BlockchainInsightsCard';
import { catalogRouteRef } from './routes';

export { AboutContent, AboutField } from './components/BlockchainInsightsCard';

export const customCatalogPagePlugin = createPlugin({
  id: 'catalog-index',
  routes: {
    catalogPage: catalogRouteRef,
  },
});

export const CustomCatalogIndexPage = customCatalogPagePlugin.provide(
  createRoutableExtension({
    component: () =>
      import('./components/CustomCatalogPage').then(m => m.CustomCatalogPage),
    mountPoint: catalogRouteRef,
  }),
);

export type {
  BlockchainInsightsCardProps,
  AboutContentProps,
  AboutFieldProps,
} from './components/BlockchainInsightsCard';

/** @public */
export const EntityBlockchainInsightsCard: (
  props: BlockchainInsightsCardProps,
) => JSX.Element = customCatalogPagePlugin.provide(
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

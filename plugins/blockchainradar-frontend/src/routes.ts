import {
  createExternalRouteRef,
  createRouteRef,
} from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'blockchain-index',
});

export const catalogIndexRouteRef = createExternalRouteRef({
  id: 'catalog-index',
});

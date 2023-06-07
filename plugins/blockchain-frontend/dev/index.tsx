import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { Content, Header, Page } from '@backstage/core-components';
import { createApiFactory, createPlugin } from '@backstage/core-plugin-api';
import { CatalogIndexPage, catalogPlugin } from '@backstage/plugin-catalog';
import {
  CatalogApi,
  MockStarredEntitiesApi,
  catalogApiRef,
  starredEntitiesApiRef,
  entityRouteRef,
} from '@backstage/plugin-catalog-react';
import { Grid, Typography } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';

import { CustomCatalogIndexPage, customCatalogPagePlugin } from '../src/plugin';
import { CustomCatalogPage } from '../src/components/CustomCatalogPage';

const mockCatalogApi = {
  getEntities: async () => {
    return {
      items: [] as Entity[],
    };
  },
  getEntityByRef: async (entityRef: string) => {
    if (entityRef === 'user:default/guest') {
      return {
        apiVersion: '1',
        kind: 'User',
        metadata: {
          name: 'guest',
          namespace: 'default',
          description: 'Anonymous to the max',
          uid: 'u1'
        },
        spec: {},
      };
    }
    return undefined;
  },
};

const fakeCatalogPlugin = createPlugin({
  id: 'catalog',
  routes: {
    catalogEntity: entityRouteRef,
  },
  apis: [
    createApiFactory({
      api: catalogApiRef,
      deps: {},
      factory: () => {
        return mockCatalogApi as CatalogApi;
      },
    }),
    createApiFactory({
      api: starredEntitiesApiRef,
      deps: {},
      factory: () => new MockStarredEntitiesApi(),
    }),
  ],
});

createDevApp()
  .registerPlugin(catalogPlugin)
  .registerPlugin(customCatalogPagePlugin)
  .addPage({
    element: <CustomCatalogIndexPage />,
    title: 'Root Page',
    path: '/catalog',
  })
  .addPage({
    element: (
      <Page themeId="home">
        <Header title="BlockchainInsightsCard" />

        <Content>
          <Grid container>
            <Grid item xs={12} md={12}>
              <Typography variant="h4">Test homepage</Typography>
            </Grid>

          </Grid>

        </Content>
      </Page>
    ),
    title: 'AnnouncementsCard',
    path: '/blockchain/BlockchainInsightsCard',
  })
  .render();

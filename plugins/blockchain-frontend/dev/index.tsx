import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { Content, Header, Page } from '@backstage/core-components';
// import { createApiFactory, createPlugin } from '@backstage/core-plugin-api';
import { CatalogIndexPage, catalogPlugin } from '@backstage/plugin-catalog';
// import {
//   CatalogApi,
//   MockStarredEntitiesApi,
//   catalogApiRef,
//   starredEntitiesApiRef,
//   entityRouteRef,
// } from '@backstage/plugin-catalog-react';
import { Grid, Typography } from '@material-ui/core';

import { customCatalogPagePlugin } from '../src/plugin';
import { CustomCatalogPage } from '../src/components/CustomCatalogPage';

createDevApp()
  .registerPlugin(catalogPlugin)
  .registerPlugin(customCatalogPagePlugin)
  .addPage({
    element: <CatalogIndexPage />,
    title: 'Root Page',
    path: '/catalog',
    children: <CustomCatalogPage />
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

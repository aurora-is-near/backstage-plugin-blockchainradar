import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { Content, Header, Page } from '@backstage/core-components';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import {
  CatalogGraphPage,
  catalogGraphPlugin,
} from '@backstage/plugin-catalog-graph';
import { apiDocsPlugin } from '@backstage/plugin-api-docs';
import { orgPlugin } from '@backstage/plugin-org';
import { Grid, Typography } from '@material-ui/core';

import { customCatalogPagePlugin } from '../src/plugin';
import { CustomCatalogPage } from '../src/components/CustomCatalogPage';
import { CustomEntityPage } from '../src/components/CustomEntityPage';

createDevApp()
  .registerPlugin(catalogPlugin)
  .registerPlugin(orgPlugin)
  .registerPlugin(catalogGraphPlugin)
  .registerPlugin(apiDocsPlugin)
  .registerPlugin(customCatalogPagePlugin)
  .addPage({
    element: <CatalogIndexPage />,
    title: 'Root Page',
    path: '/catalog',
    children: <CustomCatalogPage />,
  })
  .addPage({
    path: '/catalog/:kind/:namespace/:name',
    element: <CatalogEntityPage />,
    children: <CustomEntityPage />,
  })
  .addPage({
    path: '/catalog-graph',
    element: <CatalogGraphPage />,
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
    title: 'BlockchainInsightsCard',
    path: '/blockchain/BlockchainInsightsCard',
  })
  .render();

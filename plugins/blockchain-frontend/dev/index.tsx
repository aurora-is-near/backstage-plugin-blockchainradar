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

import {
  blockchainPlugin,
  BlockchainIndexPage,
  BlockchainEntityPage,
} from '../src/plugin';

createDevApp()
  .registerPlugin(catalogPlugin)
  .registerPlugin(orgPlugin)
  .registerPlugin(catalogGraphPlugin)
  .registerPlugin(apiDocsPlugin)
  .registerPlugin(blockchainPlugin)
  .addPage({
    title: 'Root Page',
    path: '/catalog',
    element: <CatalogIndexPage />,
    children: <BlockchainIndexPage />,
  })
  .addPage({
    path: '/catalog/:kind/:namespace/:name',
    element: <CatalogEntityPage />,
    children: <BlockchainEntityPage />,
  })
  .addPage({
    path: '/catalog-graph',
    element: <CatalogGraphPage />,
  })
  .addPage({
    element: (
      <Page themeId="home">
        <Header title="EntityBlockchainInsightsCard" />

        <Content>
          <Grid container>
            <Grid item xs={12} md={12}>
              <Typography variant="h4">Test homepage</Typography>
            </Grid>
          </Grid>
        </Content>
      </Page>
    ),
    title: 'EntityBlockchainInsightsCard',
    path: '/blockchain/BlockchainInsightsCard',
  })
  .render();

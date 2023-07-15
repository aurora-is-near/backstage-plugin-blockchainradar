import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
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

import { blockchainPlugin } from '../src/plugin';
import { BlockchainIndexPage } from '../src/components/BlockchainIndexPage';
import { BlockchainEntityPage } from '../src/components/BlockchainEntityPage';

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
  // TODO: add exported routable components
  .render();

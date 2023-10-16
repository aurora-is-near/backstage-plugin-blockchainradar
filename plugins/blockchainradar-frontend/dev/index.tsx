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
import { pagerDutyPlugin } from '@backstage/plugin-pagerduty';

import {
  blockchainPlugin,
  BlockchainEntityPage,
  BlockchainIndexPage,
} from '../src/plugin';

createDevApp()
  .registerPlugin(catalogPlugin)
  .registerPlugin(orgPlugin)
  .registerPlugin(catalogGraphPlugin)
  .registerPlugin(apiDocsPlugin)
  .registerPlugin(pagerDutyPlugin)
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
  .render();

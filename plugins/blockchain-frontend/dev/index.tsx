import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { customCatalogPagePlugin } from '../src/plugin';
import { CustomCatalogPage } from '../src/components/CustomCatalogPage';

createDevApp()
  .registerPlugin(customCatalogPagePlugin)
  .addPage({
    element: <CustomCatalogPage />,
    title: 'Root Page',
    path: '/custom-catalog-page',
  })
  .render();

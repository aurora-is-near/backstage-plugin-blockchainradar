import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import {
  DefaultFilters,
  EntityProvider,
} from '@backstage/plugin-catalog-react';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
  EntityLayout,
} from '@backstage/plugin-catalog';
import {
  CatalogGraphPage,
  catalogGraphPlugin,
} from '@backstage/plugin-catalog-graph';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import MemoryIcon from '@material-ui/icons/Memory';

import { blockchainPlugin } from '../src/plugin';
import {
  EntityBlockchainContent,
  EntitySecurityTierPicker,
} from '../src/components';
import { EntityNetworkPicker } from '../src/components/EntityNetworkPicker';

const mockContract = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    namespace: 'default',
    annotations: {
      'aurora.dev/security-tier': '1',
    },
    name: 'aurora-engine',
    title: 'Aurora (engine)',
    description: 'The Aurora engine',
    tags: ['contract', 'near'],
    links: [
      {
        url: 'https://explorer.near.org/accounts/aurora',
        title: 'Explorer: near mainnet contract',
      },
      {
        url: 'https://explorer.testnet.near.org/accounts/aurora',
        title: 'Explorer: near testnet contract',
      },
    ],
  },
  relations: [
    {
      type: 'ownedBy',
      targetRef: 'group:default/engine-team',
      target: {
        kind: 'group',
        namespace: 'default',
        name: 'engine-team',
      },
    },
    {
      type: 'partOf',
      targetRef: 'system:default/aurora-engine',
      target: {
        kind: 'system',
        namespace: 'default',
        name: 'aurora-engine',
      },
    },
    {
      type: 'providesApi',
      targetRef: 'api:default/near-mainnet-aurora',
      target: {
        kind: 'api',
        namespace: 'default',
        name: 'near-mainnet-aurora',
      },
    },
    {
      type: 'providesApi',
      targetRef: 'api:default/near-testnet-aurora',
      target: {
        kind: 'api',
        namespace: 'default',
        name: 'near-testnet-aurora',
      },
    },
  ],
  spec: {
    owner: 'engine-team',
    type: 'contract',
    lifecycle: 'production',
    system: 'aurora-engine',
    deployedAt: [
      'contract:near/mainnet/aurora',
      'contract:near/testnet/aurora',
    ],
    interactsWith: [],
  },
};

const mockMultisig = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    namespace: 'default',
    annotations: {
      'aurora.dev/security-tier': '3',
    },
    name: 'aurora-engine-admin-multisigs',
    title: 'Aurora Engine Testnet Multisigs',
    description: 'Used by the engine team for to test upgrades on testnet',
    links: [
      {
        url: 'https://explorer.testnet.near.org/accounts/aurora-engine-dao.sputnikv2.testnet',
        title: 'Explorer: near testnet multisig',
      },
    ],
  },
  relations: [
    {
      type: 'ownedBy',
      targetRef: 'group:default/engine-team',
      target: {
        kind: 'group',
        namespace: 'default',
        name: 'engine-team',
      },
    },
    {
      type: 'partOf',
      targetRef: 'system:default/aurora-engine-multisigs',
      target: {
        kind: 'system',
        namespace: 'default',
        name: 'aurora-engine-multisigs',
      },
    },
    {
      type: 'providesApi',
      targetRef: 'api:default/near-testnet-aurora-engine-dao.sputnikv2.testnet',
      target: {
        kind: 'api',
        namespace: 'default',
        name: 'near-testnet-aurora-engine-dao.sputnikv2.testnet',
      },
    },
  ],
  spec: {
    owner: 'engine-team',
    system: 'aurora-engine-multisigs',
    type: 'multisig',
    lifecycle: 'production',
    deployedAt: ['multisig:near/testnet/aurora-engine-dao.sputnikv2.testnet'],
    interactsWith: [],
  },
};

createDevApp()
  .registerPlugin(catalogPlugin)
  .registerPlugin(catalogGraphPlugin)
  .registerPlugin(blockchainPlugin)
  .addPage({
    icon: MenuBookIcon,
    title: 'Catalog',
    path: '/catalog',
    element: (
      <CatalogIndexPage
        filters={
          <>
            <DefaultFilters />
            <EntitySecurityTierPicker />
            <EntityNetworkPicker />
          </>
        }
      />
    ),
  })
  .addPage({
    path: '/catalog/:kind/:namespace/:name',
    element: <CatalogEntityPage />,
    children: (
      <EntityLayout>
        <EntityLayout.Route path="/" title="Overview">
          <EntityBlockchainContent />
        </EntityLayout.Route>
      </EntityLayout>
    ),
    // children: <BlockchainEntityPage />,
  })
  .addPage({
    path: '/catalog-graph',
    element: <CatalogGraphPage />,
  })
  .addPage({
    icon: MemoryIcon,
    title: 'Contract',
    path: '/contract',
    element: (
      <EntityProvider entity={mockContract}>
        <EntityLayout>
          <EntityLayout.Route path="/" title="Overview">
            <EntityBlockchainContent />
          </EntityLayout.Route>
        </EntityLayout>
      </EntityProvider>
    ),
  })
  .addPage({
    icon: MemoryIcon,
    title: 'Multisig',
    path: '/multisig',
    element: (
      <EntityProvider entity={mockMultisig}>
        <EntityLayout>
          <EntityLayout.Route path="/" title="Overview">
            <EntityBlockchainContent />
          </EntityLayout.Route>
        </EntityLayout>
      </EntityProvider>
    ),
  })
  .render();

# Setup

## Prerequisites

The plugins are published on Github, so you need to set the registry in `.yarnrc.yml`:

```yml
npmScopes:
  '@aurora-is-near':
    npmRegistryServer: 'https://npm.pkg.github.com'
```

## Backend

Add the plugin to your backend app:

```bash
cd packages/backend
yarn add @aurora-is-near/backstage-plugin-blockchainradar-common @aurora-is-near/backstage-plugin-blockchainradar-backend
```

Change `packages/backend/src/plugins/catalog.ts`:

```ts
import {
  ContractProcessor,
  MultisigProcessor,
  SputnikProcessor,
  NearKeysProcessor,
  SecurityPolicyProcessor,
} from '@aurora-is-near/backstage-plugin-blockchainradar-backend';

export default async function createPlugin(
  env: PluginEnvironment,
  providers?: Array<EntityProvider>,
): Promise<Router> {
  const builder = await CatalogBuilder.create(env);

  builder.addEntityProvider(
    GithubEntityProvider.fromConfig(env.config, {
      logger: env.logger,
      scheduler: env.scheduler,
    }),
  );

  // ... other processors
  builder.addProcessor(new ContractProcessor(env));
  builder.addProcessor(new MultisigProcessor(env));
  builder.addProcessor(new SputnikProcessor(env));
  builder.addProcessor(new NearKeysProcessor(env));
  builder.addProcessor(new SecurityPolicyProcessor(env));

  builder.addEntityProvider(providers ?? []);
  builder.addEntityProvider(
    GithubEntityProvider.fromConfig(env.config, {
      logger: env.logger,
      // optional: alternatively, use scheduler with schedule defined in app-config.yaml
      schedule: env.scheduler.createScheduledTaskRunner({
        frequency: { minutes: 30 },
        timeout: { minutes: 3 },
      }),
      // optional: alternatively, use schedule
      scheduler: env.scheduler,
    }),
  );

  const { processingEngine, router } = await builder.build();
  await processingEngine.start();
  return router;
}
```

In `packages/backend/src/index.ts` add the following:

```ts
import catalog from './plugins/catalog';

// ...
async function main() {
  // ...
  const catalogEnv = useHotMemoize(module, () => createEnv('catalog'));

  const apiRouter = Router();
  apiRouter.use('/catalog', await catalog(catalogEnv));
  // ...
}
```

## Frontend

Add the plugin to your frontend app:

```bash
cd packages/app
yarn add @aurora-is-near/backstage-plugin-blockchainradar-common @aurora-is-near/backstage-plugin-blockchainradar-frontend
```

Setup app instance and routes for catalog page components in `packages/app/src/App.tsx`:

```ts
import {
  blockchainPlugin,
  BlockchainIndexPage,
  BlockchainEntityPage,
} from '@aurora-is-near/backstage-plugin-blockchainradar-frontend';

const app = createApp({
  // ...
  bindRoutes({ bind }) {
    // ...
    bind(orgPlugin.externalRoutes, {
      catalogIndex: blockchainPlugin.routes.catalogPage,
    });
  },
});

// ...

const routes = (
  <FlatRoutes>
    <Route path="/catalog" element={<CatalogIndexPage />}>
      <BlockchainIndexPage />
    </Route>
    <Route
      path="/catalog/:namespace/:kind/:name"
      element={<CatalogEntityPage />}
    >
      <BlockchainEntityPage />
    </Route>
    <Route path="/catalog-graph" element={<CatalogGraphPage />} />
  </FlatRoutes>
);
```

Alternatively, expose components into your custom pages: `packages/app/src/components/catalog/EntityPage.tsx`

```ts
import { EntityBlockchainInsightsCard } from '@aurora-is-near/backstage-plugin-blockchainradar-frontend';

/// somewhere at the bottom of the page
<Grid item xs={12}>
  <EntityBlockchainInsightsCard />
</Grid>;
```

The interface to inspect the blockchain insights will be available at the bottom of the entity page.

## Config

Add the plugin to your Backstage app's `app-config.yaml` file:

```yaml
blockchain:
  etherscan:
    ethereum-mainnet:
      network: mainnet
      apiKey: ${ETHERSCAN_API_KEY}
    ethereum-goerli:
      network: goerli
      apiKey: ${ETHERSCAN_API_KEY}
    aurora-mainnet:
      network: aurora
      apiKey: ${AURORASCAN_API_KEY}
  experimental:
    plugins:
      - id: blockchain
```

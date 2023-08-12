/* eslint-disable @backstage/no-undeclared-imports */
import Router from 'express-promise-router';
import {
  createServiceBuilder,
  loadBackendConfig,
  getRootLogger,
  useHotMemoize,
  notFoundHandler,
  CacheManager,
  DatabaseManager,
  UrlReaders,
  ServerTokenManager,
  HostDiscovery,
} from '@backstage/backend-common';
import { TaskScheduler } from '@backstage/backend-tasks';
import { ServerPermissionClient } from '@backstage/plugin-permission-node';
import { DefaultIdentityClient } from '@backstage/plugin-auth-node';
import { Config } from '@backstage/config';

import catalog from './service/catalog';
// import proxy from './plugins/proxy';

const logger = getRootLogger();

function makeCreateEnv(config: Config) {
  const reader = UrlReaders.default({ logger, config });
  const discovery = HostDiscovery.fromConfig(config);
  const cacheManager = CacheManager.fromConfig(config);
  const databaseManager = DatabaseManager.fromConfig(config, { logger });
  const tokenManager = ServerTokenManager.noop();
  const taskScheduler = TaskScheduler.fromConfig(config);

  const identity = DefaultIdentityClient.create({
    discovery,
  });
  const permissions = ServerPermissionClient.fromConfig(config, {
    discovery,
    tokenManager,
  });

  return (plugin: string) => {
    const database = databaseManager.forPlugin(plugin);
    const cache = cacheManager.forPlugin(plugin);
    const scheduler = taskScheduler.forPlugin(plugin);
    return {
      logger: logger.child({ type: 'plugin', plugin }),
      database,
      cache,
      config,
      reader,
      discovery,
      scheduler,
      permissions,
      identity,
    };
  };
}

async function main() {
  const config = await loadBackendConfig({
    argv: process.argv,
    logger,
  });
  const createEnv = makeCreateEnv(config);

  const catalogEnv = useHotMemoize(module, () => createEnv('catalog'));
  // const scaffolderEnv = useHotMemoize(module, () => createEnv('scaffolder'));
  // const authEnv = useHotMemoize(module, () => createEnv('auth'));
  // const proxyEnv = useHotMemoize(module, () => createEnv('proxy'));
  // const techdocsEnv = useHotMemoize(module, () => createEnv('techdocs'));
  // const searchEnv = useHotMemoize(module, () => createEnv('search'));
  // const appEnv = useHotMemoize(module, () => createEnv('app'));
  // const eventsEnv = useHotMemoize(module, () => createEnv('events'));

  const apiRouter = Router();
  apiRouter.use('/catalog', await catalog(catalogEnv));
  // apiRouter.use('/proxy', await proxy(proxyEnv));

  // Add backends ABOVE this line; this 404 handler is the catch-all fallback
  apiRouter.use(notFoundHandler());

  // const graphqlEnv = useHotMemoize(module, () => createEnv('graphql'));

  const service = createServiceBuilder(module)
    .loadConfig(config)
    .addRouter('/api', apiRouter);
  // .addRouter('/graphql', await graphql(graphqlEnv))
  // .addRouter('', await app(appEnv));

  await service.start().catch(err => {
    console.log(err);
    process.exit(1);
  });
}

module.hot?.accept();
main().catch(error => {
  console.error(`Backend failed to start up, ${error}`);
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('CTRL+C pressed; exiting.');
  process.exit(0);
});

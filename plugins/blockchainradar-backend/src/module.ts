import {
  UserProcessor,
  GroupProcessor,
  SignerProcessor,
  ContractProcessor,
  MultisigProcessor,
  RoleGroupProcessor,
  SputnikProcessor,
  NearKeysProcessor,
  SecurityPolicyProcessor,
} from './processors';
import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';

const moduleId = 'blockchainradar';

export const catalogModuleBlockchainradar = createBackendModule({
  pluginId: 'catalog',
  moduleId,
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        catalogApi: catalogServiceRef,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        logger: coreServices.logger,
      },
      async init({ catalog, ...rest }) {
        const logger = rest.logger.child({ module: moduleId });
        const deps = { ...rest, logger };

        catalog.addProcessor(new UserProcessor(deps));
        catalog.addProcessor(new GroupProcessor(deps));
        catalog.addProcessor(new SignerProcessor(deps));
        catalog.addProcessor(new ContractProcessor(deps));
        catalog.addProcessor(new MultisigProcessor(deps));
        catalog.addProcessor(new RoleGroupProcessor(deps));
        catalog.addProcessor(new SputnikProcessor(deps));
        catalog.addProcessor(new NearKeysProcessor(deps));
        catalog.addProcessor(new SecurityPolicyProcessor(deps));
      },
    });
  },
});

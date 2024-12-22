import {
  ContractStateSpec,
  RbacSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

export abstract class RoleGroupAdapter {
  public logger;

  constructor(
    public config: Config,
    public network: string,
    public networkType: string,
    logger: LoggerService,
  ) {
    this.logger = logger.child({
      adapter: this.constructor.name,
      network,
      networkType,
    });
  }

  abstract fetchRbacSpec(
    address: string,
    stateSpec: ContractStateSpec,
  ): Promise<RbacSpec | undefined>;
}

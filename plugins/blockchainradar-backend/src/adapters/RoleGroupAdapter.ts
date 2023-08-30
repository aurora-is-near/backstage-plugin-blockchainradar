import {
  ContractStateSpec,
  RbacSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { getRootLogger } from '@backstage/backend-common';

export abstract class RoleGroupAdapter {
  public logger;

  constructor(
    public network: string,
    public networkType: string,
    logger = getRootLogger(),
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

import {
  ContractStateSpec,
  MultisigSpec,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { OwnerSpec } from '../lib/types';
import { LoggerService } from '@backstage/backend-plugin-api';

export abstract class PolicyAdapter {
  constructor(
    public network: string,
    public networkType: string,
    public logger: LoggerService,
  ) {
    this.logger = logger.child({
      adapter: this.constructor.name,
      network,
      networkType,
    });
  }

  abstract fetchMultisigSpec(
    address: string,
    stateSpec: ContractStateSpec | undefined,
  ): Promise<MultisigSpec | undefined>;

  abstract fetchMultisigOwners(
    address: string,
    stateSpec: ContractStateSpec | undefined,
  ): Promise<OwnerSpec | undefined>;
}

import { getRootLogger } from '@backstage/backend-common';
import { Config } from '@backstage/config';
import {
  ContractSourceSpec,
  ContractStateSpec,
} from '@aurora-is-near/backstage-plugin-blockchain-common';

export abstract class BlockchainAdapter {
  config: Config;
  network: string;
  networkType: string;
  logger = getRootLogger();
  requestDelaySeconds = 1;
  // is it possible to guess what that contract does
  // by reading its blockchain address?
  isHumanReadable = false;

  constructor(config: Config, network: string, networkType: string) {
    this.config = config;
    this.network = network;
    this.networkType = networkType;
    this.logger = this.logger.child({ adapter: this.constructor.name });
  }

  abstract isValidAddress(address: string): boolean;

  normalizeAddress(address: string): string {
    return address;
  }

  humanFriendlyAddress(address: string): string {
    if (address.length <= 16) {
      return address;
    }
    return `${address.slice(0, 5)}...${[
      address.slice(address.length - 4, address.length),
    ]}`;
  }

  abstract fetchSourceSpec(
    address: string,
  ): Promise<ContractSourceSpec | undefined>;

  abstract fetchStateSpec(
    address: string,
    sourceSpec: ContractSourceSpec,
  ): Promise<ContractStateSpec | undefined>;

  abstract isContract(address: string): Promise<boolean>;

  protected async delayRequest(seconds?: number) {
    await new Promise(resolve =>
      setTimeout(resolve, (seconds || this.requestDelaySeconds) * 1000),
    );
  }
}

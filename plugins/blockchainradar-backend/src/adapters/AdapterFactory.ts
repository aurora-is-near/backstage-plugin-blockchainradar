import { BlockchainProcessor } from '../processors/BlockchainProcessor';
import { NearAdapter } from './NearAdapter';
import { EvmAdapter } from './EvmAdapter';
import { BlockchainAdapter } from './BlockchainAdapter';
import { RoleGroupAdapter } from './RoleGroupAdapter';
import { OpenZeppelinAdapter } from './OpenZeppelinAdapter';
import { NearPluginsAdapter } from './NearPluginsAdapter';
import { PolicyAdapter } from './PolicyAdapter';
import { AstroDaoAdapter } from './AstroDaoAdapter';
import { SafeAdapter } from './SafeAdapter';

export class AdapterFactory {
  static adapter(
    processor: BlockchainProcessor,
    network: string,
    networkType: string,
  ): BlockchainAdapter {
    if (network === 'near') {
      return new NearAdapter(
        processor.config,
        network,
        networkType,
        processor.logger,
      );
    }
    return new EvmAdapter(
      processor.config,
      network,
      networkType,
      processor.logger,
    );
  }

  static roleGroupAdapter(
    processor: BlockchainProcessor,
    network: string,
    networkType: string,
  ): RoleGroupAdapter {
    if (network === 'near') {
      return new NearPluginsAdapter(network, networkType, processor.logger);
    }
    return new OpenZeppelinAdapter(network, networkType, processor.logger);
  }

  static policyAdapter(
    processor: BlockchainProcessor,
    network: string,
    networkType: string,
  ): PolicyAdapter {
    if (network === 'near') {
      return new AstroDaoAdapter(network, networkType, processor.logger);
    }
    return new SafeAdapter(network, networkType, processor.logger);
  }
}

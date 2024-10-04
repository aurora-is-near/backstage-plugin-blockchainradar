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
  static adapter<T extends BlockchainAdapter = BlockchainAdapter>(
    processor: BlockchainProcessor,
    network: string,
    networkType: string,
  ): T {
    if (network === 'near') {
      return new NearAdapter(
        processor.config,
        network,
        networkType,
        processor.logger,
      ) as unknown as T;
    }
    return new EvmAdapter(
      processor.config,
      network,
      networkType,
      processor.logger,
    ) as unknown as T;
  }

  static roleGroupAdapter(
    processor: BlockchainProcessor,
    network: string,
    networkType: string,
  ): RoleGroupAdapter {
    if (network === 'near') {
      return new NearPluginsAdapter(
        processor.config,
        network,
        networkType,
        processor.logger,
      );
    }
    return new OpenZeppelinAdapter(
      processor.config,
      network,
      networkType,
      processor.logger,
    );
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

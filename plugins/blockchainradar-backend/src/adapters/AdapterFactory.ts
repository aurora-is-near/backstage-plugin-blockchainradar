import { NearAdapter } from './NearAdapter';
import { EvmAdapter } from './EvmAdapter';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';
import { BlockchainAdapter } from './BlockchainAdapter';

export class AdapterFactory {
  static adapter(
    processor: BlockchainProcessor,
    network: string,
    networkType: string,
  ): BlockchainAdapter {
    if (network === 'near') {
      return new NearAdapter(processor.config, network, networkType);
    }
    return new EvmAdapter(processor.config, network, networkType);
  }
}

import { Entity } from '@backstage/catalog-model';
import { BlockchainFactory } from '../lib/BlockchainFactory';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';
import { BlockchainAddress } from './BlockchainAddress';

export class ContractComponent {
  entity: Entity;
  processor: BlockchainProcessor;

  // This is the only entity which does not need a parent
  constructor(processor: BlockchainProcessor, entity: Entity) {
    this.processor = processor;
    this.entity = entity;
    if (!this.entity.spec!.deployedAt) entity.spec!.deployedAt = [];
    if (!this.entity.spec!.interactsWith) entity.spec!.interactsWith = [];
  }

  async interactsAddresses(deployedAddr: BlockchainAddress) {
    return Promise.all(
      (this.entity.spec!.interactsWith as string[]).map(addressStr =>
        BlockchainFactory.fromUserSpecifiedAddress(
          this.processor,
          addressStr,
          deployedAddr.toEntity(),
        ),
      ),
    );
  }

  async interactsWith(deployedAddr: BlockchainAddress) {
    return (await this.interactsAddresses(deployedAddr)).filter(
      addr => addr.network === deployedAddr.network,
    );
  }

  async deployedAddresses() {
    return Promise.all(
      (this.entity.spec!.deployedAt as string[]).map(addressStr =>
        BlockchainFactory.fromUserSpecifiedAddress(
          this.processor,
          addressStr,
          this.entity,
        ),
      ),
    );
  }
}

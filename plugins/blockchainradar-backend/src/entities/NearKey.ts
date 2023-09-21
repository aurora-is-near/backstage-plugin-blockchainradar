import { BlockchainHandler } from './BlockchainHandler';
import { Entity } from '@backstage/catalog-model';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';

export class NearKey extends BlockchainHandler {
  publicKey: string;

  constructor(
    processor: BlockchainProcessor,
    parent: Entity,
    publicKey: string,
  ) {
    super(processor, parent, 'access-key');
    this.publicKey = publicKey;
  }

  entityTags() {
    return ['near', ...super.entityTags()];
  }

  entityName() {
    return this.publicKey.replace(':', '-');
  }

  entityTitle() {
    const parts = [];

    if (this.stub) parts.push('*');

    parts.push('Access Key');
    parts.push(this.publicKey.split(':')[1].slice(0, 5));

    parts.push(this.parent.metadata.name);
    if (this.parent.kind !== 'User') {
      parts.push('unknown');
    }

    return parts.join(' ');
  }

  entityMetadata() {
    return {
      ...super.entityMetadata(),
      description: `${this.publicKey}\n\nThis key has FullAccess permission on at least one of the contracts.`,
    };
  }

  toEntity(): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: this.entityMetadata(),
      spec: this.entitySpec(),
    };
  }
}

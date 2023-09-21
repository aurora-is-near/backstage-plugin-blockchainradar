import { Entity } from '@backstage/catalog-model';
import { BlockchainAddress } from './BlockchainAddress';

export class ContractDeployment extends BlockchainAddress {
  entitySpec() {
    return {
      ...super.entitySpec(),
      type: `${this.role === 'multisig' ? this.role : 'contract'}-deployment`,
      deployment: {},
      definition: 'none', // required by the API spec, overriden by ContractProcessor
    };
  }

  // TODO highlight multisigs somehow
  entityTitle() {
    const parts = [];

    if (this.stub) parts.push('*');

    parts.push(this.humanFriendlyAddress());

    if (!this.adapter.isHumanReadable) {
      parts.push(this.parent.metadata.name);
    }

    if (!['contract', 'multisig'].includes(this.role)) parts.push(this.role);

    return parts.join(' ');
  }

  entityMetadata() {
    const links = [super.toLink()];
    return {
      ...super.entityMetadata(),
      description: `${this.address} (${this.role} address)`,
      links,
    };
  }

  toEntity(): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: this.entityMetadata(),
      spec: this.entitySpec(),
    };
  }
}

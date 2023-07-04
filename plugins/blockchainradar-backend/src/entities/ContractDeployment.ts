import { Entity } from '@backstage/catalog-model';
import { BlockchainAddress } from './BlockchainAddress';

export class ContractDeployment extends BlockchainAddress {
  entitySpec() {
    return {
      ...super.entitySpec(),
      type: `${this.role}-deployment`,
      deployment: {},
      definition: 'none', // required by the API spec, overriden by ContractProcessor
      ...(this.role === 'multisig'
        ? {
            multisig: {},
          }
        : {}),
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

    if (['multisig'].includes(this.role)) parts.push(this.network);

    return parts.join(' ');
  }

  private getSafeLink() {
    const safeLink = { title: '', url: '' };
    if (this.network === 'near') {
      safeLink.title = 'Safe (AstroDao)';
      safeLink.url = `https://app.astrodao.com/dao/${this.address}`;
    } else {
      safeLink.title = 'Safe (Gnosis)';
      safeLink.url = `https://app.safe.global/${
        this.network === 'ethereum' ? 'eth' : this.network
      }:${this.address}`;
    }
    return safeLink;
  }

  entityMetadata() {
    const links = [super.toLink()];
    if (this.role === 'multisig') {
      links.push(this.getSafeLink());
    }
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

import { Entity } from '@backstage/catalog-model';
import { ContractDeployment } from './ContractDeployment';

export class MultisigDeployment extends ContractDeployment {
  entitySpec() {
    return {
      ...super.entitySpec(),
      type: `multisig-deployment`,
      multisig: {},
    };
  }

  // TODO highlight multisigs somehow
  entityTitle() {
    const parts = [super.entityTitle(), this.network];

    return parts.join(' ');
  }

  entityMetadata() {
    const metadata = super.entityMetadata();
    return {
      ...metadata,
      links: [...metadata.links, this.getMultisigLink()],
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

  private getMultisigLink() {
    const safeLink = { title: '', url: '' };
    if (this.network === 'near') {
      safeLink.title = 'Safe (AstroDao)';
      safeLink.url = `https://${
        this.networkType === 'testnet' ? 'testnet.' : ''
      }app.astrodao.com/dao/${this.address}`;
    } else {
      safeLink.title = 'Safe (Gnosis)';
      safeLink.url = `https://app.safe.global/${
        this.network === 'ethereum' ? 'eth' : this.network
      }:${this.address}`;
    }
    return safeLink;
  }
}

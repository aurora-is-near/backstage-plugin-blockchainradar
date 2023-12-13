import { Entity } from '@backstage/catalog-model';
import { ContractDeployment } from './ContractDeployment';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { PolicyAdapter } from '../adapters/PolicyAdapter';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';

export class MultisigDeployment extends ContractDeployment {
  policyAdapter: PolicyAdapter;
  constructor(
    processor: BlockchainProcessor,
    parent: Entity,
    role: string,
    network: string,
    networkType: string,
    address: string,
  ) {
    super(processor, parent, role, network, networkType, address);
    this.policyAdapter = AdapterFactory.policyAdapter(
      processor,
      network,
      networkType,
    );
  }
  entitySpec() {
    return {
      ...super.entitySpec(),
      lifecycle: this.parent.spec?.lifecycle
        ? this.parent.spec.lifecycle
        : this.entityLifecycle(),
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

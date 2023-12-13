import { Entity } from '@backstage/catalog-model';
import { BlockchainAddress } from './BlockchainAddress';
import { RoleGroupAdapter } from '../adapters/RoleGroupAdapter';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';
import { AdapterFactory } from '../adapters/AdapterFactory';

export class ContractDeployment extends BlockchainAddress {
  roleGroupAdapter: RoleGroupAdapter;
  constructor(
    processor: BlockchainProcessor,
    parent: Entity,
    role: string,
    network: string,
    networkType: string,
    address: string,
  ) {
    super(processor, parent, role, network, networkType, address);
    this.roleGroupAdapter = AdapterFactory.roleGroupAdapter(
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

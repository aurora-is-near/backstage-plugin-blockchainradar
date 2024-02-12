import { Entity, EntityLink, EntityMeta } from '@backstage/catalog-model';
import { BlockchainAdapter } from '../adapters/BlockchainAdapter';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';

import { BlockchainHandler } from './BlockchainHandler';

import * as crypto from 'crypto';
import * as bs58 from 'bs58';
import { AdapterFactory } from '../adapters/AdapterFactory';

function base58EncodeSha256(str: string): string {
  const hash = crypto.createHash('sha256').update(str).digest();
  return bs58.encode(hash);
}

const TESTNET_IDS = ['testnet', 'goerli'];
const SIGNER_KINDS = ['Group', 'User'];

export class BlockchainAddress extends BlockchainHandler {
  address: string;
  network: string; // ethereum | aurora | near
  networkType: string; // mainnet | testnet | etc
  adapter: BlockchainAdapter;

  // address is a stub when it's not explicitly defined in a yaml file
  // e.g. when it's only discovered on-chain
  stub = false;

  constructor(
    processor: BlockchainProcessor,
    parent: Entity,
    role: string,
    network: string,
    networkType: string,
    address: string,
  ) {
    super(processor, parent, role);
    this.networkType = networkType;
    this.network = network;
    this.adapter = AdapterFactory.adapter(processor, network, networkType);
    this.address = this.adapter.normalizeAddress(address);
    this.validate();
  }

  humanFriendlyAddress(): string {
    return this.adapter.humanFriendlyAddress(this.address);
  }

  validate() {
    if (!this.adapter.isValidAddress(this.address))
      throw new Error(`invalid address ${this.address}`);
    if (!this.role.match(/^[\w-]+$/))
      throw new Error(`invalid role ${this.role}`);
  }

  // long entity names need to be truncated to pass validation
  entityName() {
    let name = [this.network, this.networkType, this.address].join('-');
    if (this.networkType.includes('aurora-silo.near')) {
      name = [this.network, this.networkType.split('.')[0], this.address].join(
        '-',
      );
    }
    if (name.length > 63)
      name = [
        this.network,
        this.networkType,
        base58EncodeSha256(this.address),
      ].join('-');

    return name;
  }

  entityTitle() {
    const parts = [];

    if (this.stub) parts.push('*');

    parts.push(this.humanFriendlyAddress());
    parts.push(this.role);

    if (this.role === 'signer') {
      if (SIGNER_KINDS.includes(this.parent.kind)) {
        parts.push(this.parent.metadata.name);
      } else {
        parts.push('unknown');
      }
    }

    return parts.join(' ');
  }

  entityLifecycle() {
    return TESTNET_IDS.includes(this.networkType) ? 'testing' : 'production';
  }

  linkPrefix() {
    if (this.network === 'ethereum') {
      return `https://${
        this.networkType === 'goerli' ? 'goerli.' : ''
      }etherscan.io/address/`;
    } else if (this.network === 'near') {
      return `https://explorer.${
        this.networkType === 'testnet' ? 'testnet.' : ''
      }near.org/accounts/`;
    } else if (this.network === 'aurora') {
      return `https://explorer.${
        this.networkType === 'testnet' ? 'testnet.' : ''
      }aurora.dev/address/`;
    }
    throw new Error(`unknown network ${this.network}`); // todo emit
  }

  toLink(): EntityLink {
    return {
      url: this.linkPrefix() + this.address,
      title: ['Explorer:', this.network, this.networkType, this.role].join(' '),
    };
  }

  // we show to emit spec.address explicitly because it can't be derived from
  // entity name - it could be hashed + bs58-encoded
  // emitting role/network as well for consistency
  entitySpec(): Entity['spec'] {
    return {
      type: `${this.role}-address`,
      address: this.address,
      role: this.role,
      network: this.network,
      networkType: this.networkType,
      ...this.inheritedSpec(),
    };
  }

  entityTags() {
    const tags = [`${this.role}-address`, this.network];
    if (this.stub) tags.push('stub');
    // simple normalization to conform to backstage's tag spec
    return [
      ...tags.map(t => t.replace(/_/g, '-').replace(/-+/g, '-')),
      ...super.entityTags(),
    ];
  }

  entityMetadata(): EntityMeta {
    return {
      ...super.entityMetadata(),
      description: `${this.address} (${this.role} address)`,
      links: [this.toLink()],
    };
  }

  /**
   * Depending on the network, addresses could be different things.
   * On ethereum and aurora, it could either host a contract or a user account.
   * On Near, an address could be both at the same time
   *
   * When discovering on-chain, we are emmitting a Resource entity, but that entity is defined
   * as a resource.
   */
  toEntity(): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: this.entityMetadata(),
      spec: this.entitySpec(),
    };
  }
}

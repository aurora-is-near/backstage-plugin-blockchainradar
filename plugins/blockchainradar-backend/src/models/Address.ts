import {
  Entity,
  EntityLink,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { base58EncodeSha256 } from '../lib/utils';
import { SILO_NAMES_BY_CHAIN_ID, isSiloChainId } from '../lib/networks';

const BLOCKCHAIN_TYPES = ['contract', 'multisig', 'signer'];
const API_TYPES = ['contract', 'multisig', 'role-group'];

export interface AddressLike {
  network: string;
  networkType: string;
  address: string;
  role?: string;
}

export class Address {
  stub: boolean;
  constructor(
    public network: string,
    public networkType: string,
    public address: string,
    public role = 'signer',
  ) {
    this.stub = false;
  }

  static parseRef(ref: string) {
    const [role, compositeAddress] = ref.split(':');
    const [network, networkType, address] = compositeAddress.split('/');
    return { network, networkType, address, role };
  }

  static from(obj: AddressLike) {
    return new this(obj.network, obj.networkType, obj.address, obj.role);
  }

  static fromRef(ref: string) {
    const { network, networkType, address, role } = Address.parseRef(ref);
    return new this(network, networkType, address, role);
  }

  toRef(): string {
    return `${this.role}:${this.network}/${this.networkType}/${this.address}`;
  }

  isSame(address: Address): boolean {
    return address.address === this.address && address.isSameNetwork(this);
  }

  isSameNetwork(address: Address): boolean {
    return (
      address.network === this.network &&
      address.networkType === this.networkType
    );
  }

  getEntityRef(): string {
    return stringifyEntityRef({
      name: this.getEntityName(),
      kind: this.getEntityKind(),
      namespace: this.getEntityNamespace(),
    });
  }

  getEntityKind(): string {
    return API_TYPES.includes(this.role) ? 'API' : 'Resource';
  }

  getEntityName(): string {
    const name = [this.network, this.networkType, this.address].join('-');
    if (name.length > 63)
      return [
        this.network,
        this.networkType,
        base58EncodeSha256(this.address),
      ].join('-');

    return name;
  }

  getEntityNamespace(): string {
    return this.stub ? 'stub' : 'default';
  }

  getEntityTitle(): string {
    const parts = [];
    if (this.stub) parts.push('*');

    if (this.network === 'near') {
      const addressLength = this.address.length;
      parts.push(
        `${this.network}:${
          addressLength === 64
            ? `${this.address.slice(0, 4)}...${this.address.slice(
                addressLength - 4,
                addressLength,
              )}`
            : this.address
        }`,
      );
    } else {
      const addressLength = this.address.length;
      parts.push(
        `${this.network}:${this.address.slice(0, 6)}...${this.address.slice(
          addressLength - 4,
          addressLength,
        )}`,
      );
    }

    return parts.join(' ');
  }

  getEntityType(): string {
    return BLOCKCHAIN_TYPES.includes(this.role)
      ? `${this.role}-address`
      : 'signer-address';
  }

  getEntityTags(): string[] {
    // INFO: tagging with spec type is redundant but convenient for filtering in UI
    // TODO: add networkType tag
    const tags = [this.getEntityType(), this.network];
    if (this.stub) tags.push('stub');
    // simple normalization to conform to backstage's tag spec
    return [...tags.map(t => t.replace(/_/g, '-').replace(/-+/g, '-'))];
  }

  toEntity(): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: this.getEntityKind(),
      metadata: {
        name: this.getEntityName(),
        namespace: this.getEntityNamespace(),
        tags: this.getEntityTags(),
        title: this.getEntityTitle(),
        // INFO: address in description is redundant but convenient for searching in UI
        description: this.address,
        links: [this.toLink()],
      },
      spec: {
        type: this.getEntityType(),
        address: this.address,
        network: this.network,
        networkType: this.networkType,
      },
    };
  }

  toLink(): EntityLink {
    const networkType = isSiloChainId(this.networkType)
      ? SILO_NAMES_BY_CHAIN_ID[this.networkType]
      : this.networkType;
    return {
      url: linkPrefix(this.network, this.networkType) + this.address,
      title: ['Explorer:', this.network, networkType, this.role].join(' '),
    };
  }
}

function linkPrefix(network: string, networkType: string) {
  if (network === 'ethereum') {
    return `https://${
      networkType === 'goerli' ? 'goerli.' : ''
    }etherscan.io/address/`;
  } else if (network === 'near') {
    return `https://explorer.${
      networkType === 'testnet' ? 'testnet.' : ''
    }near.org/accounts/`;
  } else if (isSiloChainId(networkType)) {
    return `https://explorer.${SILO_NAMES_BY_CHAIN_ID[networkType]}.aurora.dev/address/`;
  } else if (network === 'aurora') {
    return `https://explorer.${
      networkType === 'testnet' ? 'testnet.' : ''
    }aurora.dev/address/`;
  }
  throw new Error(`unknown network ${network}`); // todo emit
}

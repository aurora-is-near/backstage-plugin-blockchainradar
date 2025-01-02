import { Entity } from '@backstage/catalog-model';
import { base58EncodeSha256 } from '../lib/utils';

/**
 * Public keys follow a `"<scheme>:<key>"` format, some schemes
 * like secp256k1 require base58 encoding the sha256 hash of
 * the key since its too long.
 */
export class NearAccessKey {
  stub: boolean;

  constructor(public publicKey: string) {
    this.stub = false;
  }

  static isValid(key: string): boolean {
    // TODO: make access key validation more robust
    return key.includes('ed25519') || key.includes('secp256k1');
  }

  getEntityRef() {
    return `resource:${this.getEntityNamespace()}/${this.getEntityName()}`;
  }

  getEntityName() {
    if (this.publicKey.length > 63) {
      const [scheme] = this.publicKey.split(':');
      return `${scheme}-${base58EncodeSha256(this.publicKey)}`;
    }
    return this.publicKey.replace(':', '-');
  }

  getEntityNamespace() {
    return this.stub ? 'stub' : 'default';
  }

  getEntityTitle() {
    const parts = [];

    if (this.stub) parts.push('*');

    const [scheme, key] = this.publicKey.split(':');
    parts.push(`${scheme}:${key.slice(0, 5)}`);

    return parts.join(' ');
  }

  getEntityTags(): string[] {
    const tags = ['near'];
    if (this.stub) tags.push('stub');
    // simple normalization to conform to backstage's tag spec
    return [...tags.map(t => t.replace(/_/g, '-').replace(/-+/g, '-'))];
  }

  toEntity(): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: {
        name: this.getEntityName(),
        namespace: this.getEntityNamespace(),
        tags: this.getEntityTags(),
        title: this.getEntityTitle(),
        // INFO: pk in description is redundant but convenient for searching in UI
        description: this.publicKey,
      },
      spec: {
        type: 'access-key',
        publicKey: this.publicKey,
      },
    };
  }
}

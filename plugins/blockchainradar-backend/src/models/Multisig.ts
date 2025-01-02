import { Entity, EntityLink } from '@backstage/catalog-model';
import { Contract } from './Contract';

export class Multisig extends Contract {
  constructor(network: string, networkType: string, address: string) {
    super(network, networkType, address);
    this.role = 'multisig';
  }

  getEntityType(): string {
    return 'multisig-deployment';
  }

  toEntity(): Entity {
    const model = super.toEntity();
    return {
      ...model,
      spec: {
        ...model.spec,
        type: 'multisig-deployment',
        multisig: {},
      },
    };
  }

  toMultisigLink(): EntityLink {
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

import { Entity } from '@backstage/catalog-model';
import { Address } from './Address';

export class Contract extends Address {
  constructor(network: string, networkType: string, address: string) {
    super(network, networkType, address, 'contract');
  }

  getEntityType(): string {
    return 'contract-deployment';
  }

  toEntity(): Entity {
    const model = super.toEntity();
    return {
      ...model,
      kind: 'API',
      spec: {
        ...model.spec,
        definition: '{}',
        lifecycle: 'production',
        deployment: {},
      },
    };
  }
}

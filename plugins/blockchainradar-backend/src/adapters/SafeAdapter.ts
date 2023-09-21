import { MultisigSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { PolicyAdapter } from './PolicyAdapter';
import { SafeClient } from '../lib/SafeClient';

export class SafeAdapter extends PolicyAdapter {
  public async fetchMultisigSpec(
    address: string,
  ): Promise<MultisigSpec | undefined> {
    const client = new SafeClient(this.network, this.logger);
    const safeInfo = await client.safeInfo(address);
    return { ...safeInfo, fetchDate: new Date().getTime() };
  }

  public async fetchMultisigOwners(address: string) {
    const client = new SafeClient(this.network, this.logger);
    const safeOwners = await client.safeOwners(address);
    return safeOwners;
  }
}

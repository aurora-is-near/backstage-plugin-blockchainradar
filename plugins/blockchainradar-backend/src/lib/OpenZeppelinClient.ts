import util from 'util';
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { SubgraphEntity } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { GET_ACCOUNT_ROLES, GET_CONTRACT_ACCESSCONTROL } from '../queries';
import { getRootLogger } from '@backstage/backend-common';
import { Config } from '@backstage/config';

const makeTimer = util.promisify(setTimeout);

export class OpenZeppelinClient {
  private logger;
  private client;
  private endpoint: string;

  private readonly delay: number; // minimum # of ms to wait between requests
  private ready: Promise<void>; // always await this timer before making a request.
  constructor(
    config: Config,
    network: string,
    networkType: string,
    logger = getRootLogger(),
  ) {
    this.logger = logger.child({ class: this.constructor.name, network });
    this.endpoint = this.getEndpoint(config, network, networkType);
    this.client = new ApolloClient({
      uri: this.endpoint,
      cache: new InMemoryCache(),
    });
    const baseDelay = 1000;
    const safetyFactor = 1;
    this.delay = baseDelay * safetyFactor;
    this.ready = makeTimer(0); // at start, it's ready to go immediately
  }

  public async getContractAccessControl(address: string) {
    if (!this.endpoint) {
      this.logger.warn('no configured RBAC endpoint');
      return undefined;
    }
    this.logger.debug('Performing GetContractAccessControl query');
    await this.ready;
    const { data } = await this.client.query<ContractAccessControlResponse>({
      query: GET_CONTRACT_ACCESSCONTROL,
      variables: {
        address,
      },
    });
    this.ready = makeTimer(this.delay);
    if (!data.accessControl) {
      this.logger.warn('unable to fetch contract rbac');
      return undefined;
    }
    return data.accessControl.roles.map(role => ({
      id: role.role.id,
      admin: role.admin.role.id,
      adminOf: role.adminOf.map(r => r.role.id),
      members: role.members.map(r => r.account.id),
    }));
  }

  public async getAccountRoles(address: string) {
    if (!this.endpoint) {
      this.logger.warn('no configured RBAC endpoint');
      return undefined;
    }
    this.logger.debug('Performing GetAccountAccessControl query');
    await this.ready;
    const { data } = await this.client.query<AccountRolesResponse>({
      query: GET_ACCOUNT_ROLES,
      variables: {
        address,
      },
    });
    this.ready = makeTimer(this.delay);
    if (!data.account) {
      this.logger.warn('unable to fetch account roles');
      return undefined;
    }
    return data.account.membership.map(m => ({
      role: m.accesscontrolrole.role.id,
      contract: m.accesscontrolrole.contract.id,
    }));
  }

  getEndpoint(config: Config, network: string, networkType: string) {
    const networkName = `${network}-${networkType}`;
    switch (network) {
      case 'aurora':
      case 'ethereum': {
        return networkType === 'mainnet'
          ? config.getString(`rbac.${networkName}`)
          : '';
      }
      default:
        return '';
    }
  }
}

type ContractAccessControlResponse = {
  accessControl: {
    roles: Array<{
      role: SubgraphEntity;
      admin: {
        role: SubgraphEntity;
      };
      adminOf: {
        role: SubgraphEntity;
      }[];
      members: {
        account: SubgraphEntity;
      }[];
    }>;
  } | null;
};

type AccountRolesResponse = {
  account: {
    membership: Array<{
      accesscontrolrole: {
        contract: SubgraphEntity;
        role: SubgraphEntity;
      };
    }>;
  } | null;
};

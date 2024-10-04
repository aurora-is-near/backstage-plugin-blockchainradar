import { ApolloClient, InMemoryCache } from '@apollo/client';
import { SubgraphEntity } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { GET_ACCOUNT_ROLES, GET_CONTRACT_ACCESSCONTROL } from '../queries';
import { getRootLogger } from '@backstage/backend-common';
import { Config } from '@backstage/config';

const GOERLI_ENDPOINT =
  'https://api.thegraph.com/subgraphs/name/aurora-is-near/ethereum-goerli-oz';

export class OpenZeppelinClient {
  private logger;
  private client;

  constructor(
    config: Config,
    network: string,
    networkType: string,
    logger = getRootLogger(),
  ) {
    this.logger = logger.child({ class: this.constructor.name, network });
    this.client = new ApolloClient({
      uri: this.getEndpoint(config, network, networkType),
      cache: new InMemoryCache(),
    });
  }

  public async getContractAccessControl(address: string) {
    this.logger.debug('Performing GetContractAccessControl query');
    const { data } = await this.client.query<ContractAccessControlResponse>({
      query: GET_CONTRACT_ACCESSCONTROL,
      variables: {
        address,
      },
    });
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
    this.logger.debug('Performing GetAccountAccessControl query');
    const { data } = await this.client.query<AccountRolesResponse>({
      query: GET_ACCOUNT_ROLES,
      variables: {
        address,
      },
    });
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
    const configuredEndpoint = config.getString(
      `rbac.${network}-${networkType}`,
    );
    switch (network) {
      case 'ethereum':
        return networkType === 'goerli' ? GOERLI_ENDPOINT : configuredEndpoint;
      case 'aurora':
        return configuredEndpoint;
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

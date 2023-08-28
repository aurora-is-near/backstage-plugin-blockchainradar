import { ApolloClient, InMemoryCache } from '@apollo/client';
import { Logger } from 'winston';
import { SubgraphEntity } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { GET_ACCOUNT_ROLES, GET_CONTRACT_ACCESSCONTROL } from '../queries';

const AURORA_ENDPOINT =
  'https://api.thegraph.com/subgraphs/name/openzeppelin/aurora';
const MAINNET_ENDPOINT =
  'https://api.thegraph.com/subgraphs/name/diegofigs/aurora-eth-oz';

export class OpenZeppelinClient {
  private logger;
  private client;

  constructor(logger: Logger, network: string) {
    this.logger = logger.child({ component: 'OpenZeppelinClient' });
    this.client = new ApolloClient({
      uri: network === 'aurora' ? AURORA_ENDPOINT : MAINNET_ENDPOINT,
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
    return data.accessControl;
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
    return data.account;
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

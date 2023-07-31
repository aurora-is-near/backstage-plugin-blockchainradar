import { ApolloClient, InMemoryCache } from '@apollo/client';
import { GET_ACCOUNT_ROLES, GET_CONTRACT_ACCESSCONTROL } from '../queries';
import { Logger } from 'winston';

const client = new ApolloClient({
  uri: 'https://api.thegraph.com/subgraphs/name/openzeppelin/aurora',
  cache: new InMemoryCache(),
});

export class OpenZeppelinClient {
  private logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'OpenZeppelinClient' });
  }

  public async getContractAccessControl(address: string) {
    this.logger.debug('Performing GetContractAccessControl query');
    const { data } = await client.query<ContractAccessControlResponse>({
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
    const { data } = await client.query<AccountRolesResponse>({
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

type SubgraphEntity = {
  id: string;
};

type ContractAccessControlResponse = {
  accessControl: {
    roles: Array<{
      role: SubgraphEntity;
      admin: {
        role: SubgraphEntity;
      };
      adminOf: {
        role: SubgraphEntity;
      };
      members: {
        account: SubgraphEntity;
      };
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

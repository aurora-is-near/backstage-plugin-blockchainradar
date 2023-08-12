import { gql } from '@apollo/client';

export const GET_CONTRACT_ACCESSCONTROL = gql`
  query GetContractAccessControl($address: String!) {
    accessControl(id: $address) {
      roles {
        role {
          id
        }
        admin {
          role {
            id
          }
        }
        adminOf {
          role {
            id
          }
        }
        members {
          account {
            id
          }
        }
      }
    }
  }
`;

export const GET_ACCOUNT_ROLES = gql`
  query GetAccountAccessControl($address: String!) {
    account(id: $address) {
      membership {
        accesscontrolrole {
          contract {
            id
          }
          role {
            id
          }
        }
      }
    }
  }
`;

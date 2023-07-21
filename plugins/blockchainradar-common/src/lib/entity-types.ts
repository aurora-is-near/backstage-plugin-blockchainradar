// eslint-disable-next-line @backstage/no-undeclared-imports
import {
  ApiEntity,
  ComponentEntity,
  ResourceEntity,
  UserEntity,
  Entity,
  isApiEntity,
  isResourceEntity,
  isUserEntity,
  isComponentEntity,
} from '@backstage/catalog-model';
import {
  MultisigSpec,
  NearKeysSpec,
  ContractDeploymentSpec,
  SignerSpec,
} from './entity-specs';

type Literal<T> = {
  [K in keyof T]: T[K];
};

export interface BlockchainUser extends UserEntity {
  spec: Literal<
    UserEntity['spec'] & {
      interactsWith?: string[];
      keys?: string[];
      deprecated?: string[];
      nearKeys?: NearKeysSpec;
    }
  >;
}

export function isBlockchainUser(entity: Entity): entity is BlockchainUser {
  return isUserEntity(entity);
}

export interface ContractComponentEntity extends ComponentEntity {
  spec: ComponentEntity['spec'] & {
    type: 'contract';
  };
}

export function isContractComponent(
  entity: Entity,
): entity is ContractComponentEntity {
  return isComponentEntity(entity) && entity.spec.type === 'contract';
}

export interface MultisigComponentEntity extends ComponentEntity {
  spec: ComponentEntity['spec'] & {
    type: 'contract';
  };
}

export function isMultisigComponent(
  entity: Entity,
): entity is MultisigComponentEntity {
  return isComponentEntity(entity) && entity.spec.type === 'multisig';
}

export interface BlockchainAddressEntity extends Entity {
  kind: ApiEntity['kind'] | ResourceEntity['kind'];
  spec: Literal<
    (ApiEntity['spec'] | ResourceEntity['spec']) & {
      lifecycle: string;
      address: string;
      network: string;
      networkType: string;
      role: string;
      nearKeys?: NearKeysSpec;
    }
  >;
}

export function isBlockchainAddress(
  entity: Entity,
): entity is BlockchainAddressEntity {
  return !!(entity as BlockchainAddressEntity).spec?.address;
}

export interface ContractDeploymentEntity extends ApiEntity {
  spec: Literal<
    ApiEntity['spec'] &
      BlockchainAddressEntity['spec'] & {
        type: 'contract-deployment' | 'multisig-deployment';
        deployment?: ContractDeploymentSpec;
      }
  >;
}

// Also processes multisig contracts - needs to fetch the policy
// from the on-chain state
export function isContractDeployment(
  entity: Entity,
): entity is ContractDeploymentEntity {
  return (
    isApiEntity(entity) &&
    ['contract-deployment', 'multisig-deployment'].includes(entity.spec.type)
  );
}

/**
 * Bespoke (AdminControlled) roles/mulstisigs are discovered on-chain
 * by the ContractProcessor and those autogenerated entities
 * are of "Resource/admin-address" type - subject to change in the future
 *
 * Kept for backwards-compatibility only
 *
 * Explicitly defined multisig deployments are emitted as "API/multisig-deployment""
 *
 */
export interface MultisigDeploymentEntity extends Entity {
  kind: ApiEntity['kind'] | ResourceEntity['kind'];
  spec: Literal<
    ApiEntity['spec'] &
      BlockchainAddressEntity['spec'] & {
        type: 'multisig-deployment' | 'admin-address';
        multisig?: MultisigSpec;
      }
  >;
}

export function isMultisigDeployment(
  entity: Entity,
): entity is MultisigDeploymentEntity {
  return (
    (isResourceEntity(entity) && entity.spec.type === 'admin-address') ||
    (isApiEntity(entity) && entity.spec.type === 'multisig-deployment')
  );
}

export interface SignerEntity extends BlockchainAddressEntity {
  kind: ResourceEntity['kind'];
  spec: Literal<
    Omit<BlockchainAddressEntity['spec'], 'type'> &
      SignerSpec & {
        type: 'signer-address';
        lastSigned: number;
      }
  >;
}

export function isSigner(entity: Entity): entity is SignerEntity {
  return isResourceEntity(entity) && entity.spec.type === 'signer-address';
}

export interface CouncilEntity extends BlockchainAddressEntity {
  kind: ResourceEntity['kind'];
  spec: Literal<
    Omit<BlockchainAddressEntity['spec'], 'type'> & {
      type: 'council-address';
    }
  >;
}

export function isCouncil(entity: Entity): entity is CouncilEntity {
  return isResourceEntity(entity) && entity.spec.type === 'council-address';
}

export interface AccessKeyEntity extends BlockchainAddressEntity {
  kind: ResourceEntity['kind'];
  spec: Literal<
    Omit<BlockchainAddressEntity['spec'], 'type'> & {
      type: 'access-key';
    }
  >;
}

export function isAccessKey(entity: Entity): entity is AccessKeyEntity {
  return isResourceEntity(entity) && entity.spec.type === 'access-key';
}

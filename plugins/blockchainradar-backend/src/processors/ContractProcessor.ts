import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import {
  Entity,
  RELATION_API_PROVIDED_BY,
  RELATION_CONSUMES_API,
  RELATION_DEPENDS_ON,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  ContractComponentEntity,
  ContractDeploymentEntity,
  ContractDeploymentSpec,
  isContractComponent,
  isContractDeployment,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { Address } from '../models/Address';
import { Contract } from '../models/Contract';
import { Role } from '../models/Role';
import { AdapterFactory } from '../adapters/AdapterFactory';

function dashed(input: string) {
  // Convert camelCase to lower_underscored
  let formattedString = input.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();

  // Convert UPPER_UNDERSCORED to lower_underscored
  formattedString = formattedString.replace(/_/g, '-');

  return formattedString;
}

const DEPLOYMENT_SOURCE_RUN_ID = 'deployment-source-fetch';
const DEPLOYMENT_STATE_RUN_ID = 'deployment-state-fetch';
const DEPLOYMENT_RBAC_RUN_ID = 'deployment-rbac-fetch';

export class ContractProcessor extends BlockchainProcessor {
  async postProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ) {
    if (isContractComponent(entity)) {
      return this.processContractComponent(entity, location, emit);
    } else if (isContractDeployment(entity)) {
      return this.processContractDeployment(entity, location, emit, cache);
    }
    return entity;
  }

  /**
   * Emits deployments (API kind) from deployedAt/interactsWith specs
   * also appends etherscan links
   *
   * TODO it does not differintiate between accounts and contracts
   * when emitting APIs. Need to add take roles into account or discover
   * directly from the blockchain
   *
   * WARNING: All deployedAt/interactsWith entities must be contract addresses
   */
  async processContractComponent(
    entity: ContractComponentEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    if (entity.spec.deployedAt) {
      const contracts = entity.spec.deployedAt.map(ref =>
        Contract.fromRef(ref),
      );
      for (const contract of contracts) {
        this.appendLink(entity, contract.toLink());
        const contractEntity = contract.toEntity();
        contractEntity.spec = {
          ...contractEntity.spec,
          owner: this.ownerSpec(entity),
          system: this.systemSpec(entity),
        };

        this.emitRelationship(
          emit,
          RELATION_API_PROVIDED_BY,
          entity,
          contractEntity,
        );
        emit(processingResult.entity(location, contractEntity));

        if (entity.spec.interactsWith) {
          const addresses = entity.spec.interactsWith
            .map(ref => Address.fromRef(ref))
            .filter(addr => addr.isSameNetwork(contract));
          for (const address of addresses) {
            this.appendLink(entity, address.toLink());

            const adapter = AdapterFactory.adapter(
              this,
              address.network,
              address.networkType,
            );
            const isContract = await adapter.isContract(address.address);
            const target = isContract ? Contract.from(address) : address;
            const addressEntity = await this.stubOrFind(target);
            addressEntity.spec = {
              ...addressEntity.spec,
              owner: this.ownerSpec(entity),
              system: this.systemSpec(entity),
            };

            this.emitRelationship(
              emit,
              RELATION_CONSUMES_API,
              contractEntity,
              addressEntity,
            );
            if (target.stub) {
              emit(processingResult.entity(location, addressEntity));
            }
          }
        }
      }
    }
    return entity;
  }

  /**
   * Ingests sources + contract state for the API entities
   * emits interactions entities discovered from the state
   * Also processes multisig contracts - needs to fetch the policy
   * from the on-chain state
   *
   * TODO uses one shared mutex for source code, state and rbac fetching
   * the upstream class needs to support multiple mutexes per processor
   */
  async processContractDeployment(
    entity: ContractDeploymentEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    cache: CatalogProcessorCache,
  ) {
    const contract = Contract.from(entity.spec);
    const adapter = AdapterFactory.adapter(
      this,
      contract.network,
      contract.networkType,
    );

    const deploymentSpec: ContractDeploymentSpec =
      (await this.fetchCachedSpec(cache, DEPLOYMENT_SOURCE_RUN_ID)) || {};
    if (!this.isCacheUpToDate(deploymentSpec.source)) {
      await this.runExclusive(
        DEPLOYMENT_SOURCE_RUN_ID,
        contract.address,
        async _logger => {
          try {
            deploymentSpec.source = await adapter.fetchSourceSpec(
              contract.address,
            );
            if (deploymentSpec.source) {
              this.logger.debug(
                `Source spec found for ${entity.metadata.name}`,
              );
              await this.setScopedCachedSpec(
                DEPLOYMENT_SOURCE_RUN_ID,
                cache,
                deploymentSpec.source,
              );
            }
          } catch (error) {
            this.logger.warn(
              `unable to fetch contract source for ${contract.address}`,
            );
          }
        },
      );
    } else {
      await this.setScopedCachedSpec(
        DEPLOYMENT_SOURCE_RUN_ID,
        cache,
        deploymentSpec.source!,
      );
    }

    if (!this.isCacheUpToDate(deploymentSpec.state)) {
      await this.runExclusive(
        DEPLOYMENT_STATE_RUN_ID,
        contract.address,
        async _logger => {
          try {
            deploymentSpec.state = await adapter.fetchStateSpec(
              contract.address,
              deploymentSpec.source!,
            );
            if (deploymentSpec.state) {
              this.logger.debug(`State spec found for ${entity.metadata.name}`);
              await this.setScopedCachedSpec(
                DEPLOYMENT_STATE_RUN_ID,
                cache,
                deploymentSpec.state,
              );
            }
          } catch (error) {
            this.logger.warn(
              `unable to fetch contract state for ${contract.address}`,
            );
          }
        },
      );
    } else {
      await this.setScopedCachedSpec(
        DEPLOYMENT_STATE_RUN_ID,
        cache,
        deploymentSpec.state!,
      );
    }

    if (!this.isCacheUpToDate(deploymentSpec.rbac)) {
      const roleGroupAdapter = AdapterFactory.roleGroupAdapter(
        this,
        contract.network,
        contract.networkType,
      );
      await this.runExclusive(
        DEPLOYMENT_RBAC_RUN_ID,
        contract.address,
        async _logger => {
          if (deploymentSpec.state) {
            deploymentSpec.rbac = await roleGroupAdapter.fetchRbacSpec(
              contract.address,
              deploymentSpec.state,
            );
            if (deploymentSpec.rbac) {
              this.logger.debug(`Rbac spec found for ${entity.metadata.name}`);
              this.appendTags(entity, 'rbac');
              await this.setScopedCachedSpec(
                DEPLOYMENT_RBAC_RUN_ID,
                cache,
                deploymentSpec.rbac,
              );
            }
          }
        },
      );
    } else {
      await this.setScopedCachedSpec(
        DEPLOYMENT_RBAC_RUN_ID,
        cache,
        deploymentSpec.rbac!,
      );
    }

    if (deploymentSpec.state?.interactsWith) {
      const addresses = Object.entries(deploymentSpec.state.interactsWith)
        .map(
          ([role, address]) =>
            new Address(
              contract.network,
              contract.networkType,
              address,
              dashed(role),
            ),
        )
        .filter(address => !address.isSame(contract));
      for (const address of addresses) {
        try {
          const isContract = await adapter.isContract(address.address);
          const target = isContract ? Contract.from(address) : address;
          const addressEntity = await this.stubOrFind(target);

          this.emitRelationship(
            emit,
            RELATION_CONSUMES_API,
            entity,
            addressEntity,
          );
          if (target.stub) {
            addressEntity.spec = {
              ...addressEntity.spec,
              interactions: {
                ...(typeof addressEntity.spec?.interactions === 'object' &&
                  addressEntity.spec.interactions),
                [contract.getEntityName()]: address.role,
              },
              owner: this.ownerSpec(entity),
              system: this.systemSpec(entity),
            };
            this.appendTags(addressEntity, 'contract-state');

            emit(processingResult.entity(location, addressEntity));
          }
        } catch (err) {
          this.logger.debug(err);
        }
      }
    }

    if (deploymentSpec.rbac?.roles) {
      // TODO move this to the ETH-specific discovery
      for (const role of deploymentSpec.rbac.roles) {
        const roleGroup = new Role(
          entity.spec.network,
          entity.spec.networkType,
          entity.spec.address,
          role.id,
        );
        roleGroup.roleName = role.roleName || role.id;
        roleGroup.admin = role.admin;
        roleGroup.adminOf = role.adminOf;
        roleGroup.members = role.members;
        this.logger.debug(
          `RoleGroup (${entity.metadata.name}): ${roleGroup.roleName}`,
        );
        const roleEntity = roleGroup.toEntity();
        roleEntity.spec = {
          ...roleEntity.spec,
          owner: this.ownerSpec(entity),
          system: this.systemSpec(entity),
        };

        this.emitRelationship(emit, RELATION_DEPENDS_ON, entity, roleEntity);
        emit(processingResult.entity(location, roleEntity));
      }
    }

    entity.spec.deployment = deploymentSpec;
    if (entity.spec.deployment?.source?.abi) {
      entity.spec.definition = entity.spec.deployment.source.abi;
    }

    return entity;
  }
}

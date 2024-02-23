import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  ContractDeploymentEntity,
  isContractComponent,
  isContractDeployment,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { ContractComponent } from '../entities/ContractComponent';
import { BlockchainFactory } from '../lib/BlockchainFactory';
import { BlockchainProcessor } from './BlockchainProcessor';
import { RoleGroup } from '../entities/RoleGroup';
import { ContractDeployment } from '../entities/ContractDeployment';

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
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const contract = new ContractComponent(this, entity);
    for (const deployment of await contract.deployedAddresses()) {
      this.appendLink(entity, deployment);
      deployment.emitDeployedBy(emit);
      emit(processingResult.entity(location, deployment.toEntity()));

      // emit interactions between the contract and the other addresses on the same network
      for (const targetAddr of await contract.interactsWith(deployment)) {
        this.appendLink(entity, targetAddr);
        // at this point we don't yet know what kind of entity targetAddr is,
        // it could be either a normal contract, multisig, or a user account.
        await this.emitActsOn(targetAddr, location, emit);
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
    const deployment = await BlockchainFactory.fromEntity<ContractDeployment>(
      this,
      entity,
      'contract',
    );
    const deploymentSpec = entity.spec.deployment;
    if (deploymentSpec) {
      if (!this.isCacheUpToDate(deploymentSpec.source)) {
        await this.runExclusive(
          DEPLOYMENT_SOURCE_RUN_ID,
          deployment.address,
          async _logger => {
            try {
              deploymentSpec.source = await deployment.adapter.fetchSourceSpec(
                deployment.address,
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
                `unable to fetch contract source for ${deployment.address}`,
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
          deployment.address,
          async _logger => {
            try {
              deploymentSpec.state = await deployment.adapter.fetchStateSpec(
                deployment.address,
                deploymentSpec.source!,
              );
              if (deploymentSpec.state) {
                this.logger.debug(
                  `State spec found for ${entity.metadata.name}`,
                );
                await this.setScopedCachedSpec(
                  DEPLOYMENT_STATE_RUN_ID,
                  cache,
                  deploymentSpec.state,
                );
              }
            } catch (error) {
              this.logger.warn(
                `unable to fetch contract state for ${deployment.address}`,
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
        await this.runExclusive(
          DEPLOYMENT_RBAC_RUN_ID,
          deployment.address,
          async _logger => {
            if (entity.spec.deployment?.state) {
              deploymentSpec.rbac =
                await deployment.roleGroupAdapter.fetchRbacSpec(
                  entity.spec.address,
                  entity.spec.deployment.state,
                );
              if (deploymentSpec.rbac) {
                this.logger.debug(
                  `Rbac spec found for ${entity.metadata.name}`,
                );
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
        for (const [role, val] of Object.entries(
          deploymentSpec.state.interactsWith,
        )) {
          try {
            const intAddr = await BlockchainFactory.fromEntity(
              this,
              entity,
              dashed(role),
              val,
            );
            // No need to emit interactions with itself
            if (intAddr.address !== deployment.address)
              await this.emitActsOn(intAddr, location, emit, [
                'contract-state',
              ]);
          } catch (err) {
            this.logger.debug(err);
          }
        }
      }

      if (deploymentSpec.rbac?.roles) {
        // TODO move this to the ETH-specific discovery
        for (const role of deploymentSpec.rbac.roles) {
          const roleGroup = new RoleGroup(
            this,
            entity,
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
          roleGroup.emitDependencyOf(emit);
          emit(processingResult.entity(location, roleGroup.toEntity()));
        }
      }
    }

    entity.spec.deployment = deploymentSpec;
    if (entity.spec.deployment?.source?.abi) {
      entity.spec.definition = entity.spec.deployment.source.abi;
    }

    return entity;
  }
}

import {
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
import { OpenZeppelinClient } from '../lib/OpenZeppelinClient';
import { BlockchainProcessor } from './BlockchainProcessor';

export class ContractProcessor extends BlockchainProcessor {
  async postProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    if (isContractComponent(entity)) {
      return this.processContractComponent(entity, location, emit);
    } else if (isContractDeployment(entity)) {
      return this.processContractDeployment(entity, location, emit);
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
   * TODO uses one shared mutex for both source code and state fetching
   * the upstream class needs to support multiple mutexes per processor
   */
  async processContractDeployment(
    entity: ContractDeploymentEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const deployment = await BlockchainFactory.fromEntity(
      this,
      entity,
      'contract',
    );
    const deploymentSpec = entity.spec.deployment;
    if (deploymentSpec) {
      if (!this.isCacheUpToDate(deploymentSpec.source)) {
        await this.runExclusive(
          'deployment-source-fetch',
          deployment.address,
          async _logger => {
            try {
              deploymentSpec.source = await deployment.adapter.fetchSourceSpec(
                deployment.address,
              );
            } catch (error) {
              this.logger.warn(
                `unable to fetch contract source for ${deployment.address}`,
              );
            }
          },
        );
      }

      if (!this.isCacheUpToDate(deploymentSpec.state)) {
        await this.runExclusive(
          'deployment-state-fetch',
          deployment.address,
          async _logger => {
            try {
              deploymentSpec.state = await deployment.adapter.fetchStateSpec(
                deployment.address,
                deploymentSpec.source!,
              );
            } catch (error) {
              this.logger.warn(
                `unable to fetch contract state for ${deployment.address}`,
              );
            }
          },
        );
      }

      const ozClient = new OpenZeppelinClient(this.logger);
      if (
        entity.spec.network !== 'near' &&
        !this.isCacheUpToDate(deploymentSpec.rbac)
      ) {
        await this.runExclusive(
          'deployment-rbac-fetch',
          deployment.address,
          async _logger => {
            const accessControl = await ozClient.getContractAccessControl(
              deployment.address,
            );
            const accountRoles = await ozClient.getAccountRoles(
              deployment.address,
            );
            if (accessControl?.roles || accountRoles?.membership) {
              this.appendTags(entity, 'rbac');
              deploymentSpec.rbac = {
                roles: accessControl?.roles,
                membership: accountRoles?.membership,
                fetchDate: new Date().getTime(),
              };
            }
          },
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
              role,
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
    }

    entity.spec.deployment = deploymentSpec;
    if (entity.spec.deployment?.source?.abi) {
      entity.spec.definition = entity.spec.deployment.source.abi;
    }

    return entity;
  }
}

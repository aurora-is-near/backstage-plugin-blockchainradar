import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  MultisigSpec,
  MultisigDeploymentEntity,
  isMultisigComponent,
  isMultisigDeployment,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { SafeClient } from '../lib/SafeClient';
import { BlockchainFactory } from '../lib/BlockchainFactory';
import { ContractComponent } from '../entities/ContractComponent';

export class MultisigProcessor extends BlockchainProcessor {
  async postProcessEntity?(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (isMultisigComponent(entity)) {
      return this.processContractComponent(entity, location, emit);
    } else if (isMultisigDeployment(entity)) {
      return this.processMultisigDeployment(entity, location, emit);
    }
    return entity;
  }

  async processContractComponent(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const contract = new ContractComponent(this, entity);
    // don't parse interactsWith for multisigs as we expect interactions
    // to be defined on the smart contract side or discovered on-chain
    for (const deployment of await contract.deployedAddresses()) {
      this.appendLink(entity, deployment);
      deployment.emitDeployedBy(emit);
      emit(processingResult.entity(location, deployment.toEntity()));
    }
    return entity;
  }

  async processMultisigDeployment(
    entity: MultisigDeploymentEntity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const logger = this.logger.child({
      component: 'multisig-deployment-discovery',
    });
    logger.debug(`${entity.metadata.name} fetching safe owners`);

    const multisig = await BlockchainFactory.fromEntity(this, entity);
    const safeClient = new SafeClient(multisig);
    const multisigOwners = await safeClient.safeOwners();

    logger.debug(`${entity.metadata.name} owners: ${multisigOwners.length}`);
    if (multisigOwners.length > 0) {
      entity.metadata.tags!.push('multisig');
    } else {
      entity.metadata.tags!.push('non-multisig');
    }
    // console.log('multisig owners:', multisigOwners);
    let hasUnknown = false;
    for (const ownerAddr of multisigOwners) {
      await ownerAddr.stubOrFind(this.catalogClient);
      ownerAddr.emitSignerOf(emit);
      if (ownerAddr.stub) {
        const signer = ownerAddr.toEntity();
        hasUnknown = true;
        emit(processingResult.entity(location, signer));
      }
    }

    const tags = multisig.entityTags();
    const hasAllowUnknown = tags
      ? tags.some(tag => tag === 'allow-unknown')
      : false;
    logger.info(`${entity.metadata.name} Policy Check => ${!hasUnknown}`);
    if (hasUnknown && !hasAllowUnknown) {
      this.appendTags(entity, 'has-unknown');
    }

    let multisigSpec = entity.spec.multisig;
    if (!this.isCacheUpToDate(multisigSpec)) {
      await this.runExclusive(
        'multisig-info-fetch',
        multisig.address,
        async _logger => {
          if (entity.spec) {
            try {
              multisigSpec = (await safeClient.safeInfo()) as MultisigSpec;
              multisigSpec.fetchDate = new Date().valueOf();
            } catch (error) {
              _logger.error(error);
            }
          }
        },
      );
    }
    entity.spec.multisig = multisigSpec;
    return entity;
  }
}

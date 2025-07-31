import {
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  MultisigDeploymentEntity,
  isMultisigComponent,
  isMultisigDeployment,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';
import { ContractComponent } from '../entities/ContractComponent';
import { BlockchainFactory } from '../lib/BlockchainFactory';
import { MultisigDeployment } from '../entities/MultisigDeployment';
import { OwnerSpec } from '../lib/types';

const MULTISIG_OWNERS_RUN_ID = 'multisig-owners-fetch';

export class MultisigProcessor extends BlockchainProcessor {
  async postProcessEntity?(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
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
    const multisig = await BlockchainFactory.fromEntity<MultisigDeployment>(
      this,
      entity,
      'multisig',
    );

    let ownerSpec: OwnerSpec | undefined;
    await this.runExclusive(
      MULTISIG_OWNERS_RUN_ID,
      multisig.address,
      async logger => {
        try {
          this.logger.debug(`${entity.metadata.name} fetching safe owners`);
          ownerSpec = await multisig.policyAdapter.fetchMultisigOwners(
            entity.spec.address,
            entity.spec.deployment?.state,
          );
        } catch (error) {
          logger.error(error);
        }
      },
    );

    if (ownerSpec?.owners) {
      const multisigOwners = await Promise.all(
        ownerSpec.owners.map(owner =>
          BlockchainFactory.fromBlockchainAddress(multisig, 'signer', owner),
        ),
      );
      this.logger.debug(
        `${entity.metadata.name} owners: ${multisigOwners.length}`,
      );
      if (multisigOwners.length > 0) {
        this.appendTags(entity, 'multisig');
      } else {
        this.appendTags(entity, 'non-multisig');
      }

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
      if (hasUnknown && !hasAllowUnknown) {
        this.appendTags(entity, 'has-unknown');
      }
    }

    let multisigSpec = entity.spec.multisig;
    await this.runExclusive(
      'multisig-info-fetch',
      multisig.address,
      async logger => {
        try {
          multisigSpec = await multisig.policyAdapter.fetchMultisigSpec(
            entity.spec.address,
            entity.spec.deployment?.state,
          );
        } catch (error) {
          logger.error(error);
        }
      },
    );
    entity.spec.multisig = multisigSpec;
    return entity;
  }
}

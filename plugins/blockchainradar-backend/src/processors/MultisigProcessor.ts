import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { MultisigSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { SafeClient } from '../lib/SafeClient';
import { BlockchainFactory } from '../lib/BlockchainFactory';
import { BlockchainProcessor } from './BlockchainProcessor';
import { ContractComponent } from '../entities/ContractComponent';
import {
  BlockchainUser,
  isBlockchainUser,
  isMultisigComponent,
  isMultisigDeployment,
  isSigner,
  MultisigDeploymentEntity,
  SignerEntity,
} from '../lib/types';
import { EvmAdapter } from '../adapters/EvmAdapter';

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
    } else if (isBlockchainUser(entity)) {
      return this.processBlockchainUser(entity, location, emit);
    } else if (isSigner(entity) && entity.spec.network !== 'near') {
      return this.processSigner(entity);
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

  async processSigner(entity: SignerEntity) {
    const evmAdapter = new EvmAdapter(
      this.config,
      entity.spec.network,
      entity.spec.networkType,
    );
    const lastTx = await evmAdapter.fetchLastTransaction(entity.spec.address);
    const lastSignatureTimestamp = lastTx?.timeStamp;
    entity.spec.lastSigned = parseInt(lastSignatureTimestamp || "0") * 1000;
    return entity;
  }

  async processBlockchainUser(
    entity: BlockchainUser,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ) {
    const logger = this.logger.child({ component: 'user-discovery' });
    const isRetired = entity.metadata.tags?.includes('retired');
    if (entity.spec.interactsWith) {
      logger.debug(`${entity.metadata.name} fetching user addresses`);
      const interactsWith = await Promise.all(
        entity.spec.interactsWith.map(addressStr =>
          BlockchainFactory.fromUserSpecifiedAddress(this, addressStr, entity),
        ),
      );
      // Users only need to explicitly define their wallet addresses
      // once (for signer role) - EVM addresses for other chains are emitted
      // automatically
      for (const addr of interactsWith) {
        // TODO all of this logic needs to be abstracted out to the Adapters
        if (addr.role === 'signer' && addr.network !== 'near') {
          for (const network of ['ethereum', 'aurora']) {
            if (
              !interactsWith.some(
                a => a.network === network && a.address === addr.address,
              )
            ) {
              logger.debug(
                `no ${network} signer for ${addr.address} found, appending`,
              );
              // a lot of user experience depends on the fact that
              // all signers are directly owned by the User entity
              // hence can't use BlockchainFactory.from* methods
              const newAddr = await BlockchainFactory.contractOrAccount(
                this,
                entity,
                addr.role,
                addr.address,
                network,
                addr.networkType, // this will not work long term - needs to be refactored with adapters
              );
              interactsWith.push(newAddr);
            }
          }
        }
        emit(processingResult.entity(location, addr.toEntity()));
        addr.emitOwnedBy(emit);
      }
      const deprecated = entity.spec.deprecated || [];
      logger.debug(`${entity.metadata.name} fetching deprecated addresses`);
      const deprecatedSigners = (
        await Promise.all(
          deprecated.map(ref => {
            return BlockchainFactory.fromUserSpecifiedAddress(
              this,
              ref,
              entity,
            );
          }),
        )
      ).filter(addr => addr.role === 'signer');
      const deprecatedAddresses = deprecatedSigners.map(s => s.address);
      const activeSigners = interactsWith.filter(
        signer => !deprecatedAddresses.includes(signer.address),
      );
      for (const addr of activeSigners) {
        const signer = addr.toEntity();
        if (isRetired) {
          this.appendTags(signer, 'deprecated');
        }
        emit(processingResult.entity(location, signer));
        addr.emitOwnedBy(emit);
      }
      for (const addr of deprecatedSigners) {
        const signer = addr.toEntity();
        this.appendTags(signer, 'deprecated');
        emit(processingResult.entity(location, signer));
        addr.emitOwnedBy(emit);
      }
    }
    return entity;
  }
}

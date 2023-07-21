import {
  CatalogProcessorCache,
  CatalogProcessorEmit,
} from '@backstage/plugin-catalog-node';
import {
  Entity,
  isResourceEntity,
  parseEntityRef,
  RELATION_API_CONSUMED_BY,
  RELATION_OWNED_BY,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  isAccessKey,
  isContractDeployment,
  isCouncil,
  isSigner,
} from '@aurora-is-near/backstage-plugin-blockchainradar-common';

import { BlockchainProcessor } from './BlockchainProcessor';

export class SecurityPolicyProcessor extends BlockchainProcessor {
  async postProcessEntity?(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    this.logger.debug(
      `Entity (${entity.kind}) => ${entity.metadata.name} (${entity.spec?.type})`,
    );
    const securityTier =
      entity.metadata.annotations?.['aurora.dev/security-tier'];
    this.logger.debug(`${entity.metadata.name} security tier: ${securityTier}`);
    // if (isMultisigDeployment(entity)) {
    //   return this.processMultisigDeployment(entity);
    // } else if (isContractDeployment(entity) && entity.spec.network === 'near') {
    if (isContractDeployment(entity) && entity.spec.network === 'near') {
      return this.processNearContract(entity);
    } else if (isSigner(entity) || isAccessKey(entity) || isCouncil(entity)) {
      return this.processSignerOrAccessKey(entity);
    }
    return entity;
  }

  // @ts-ignore
  private async processMultisigDeployment(entity: Entity) {
    const logger = this.logger.child({ component: 'multisig-check' });

    const owners = [];
    try {
      const multisigFromApi = await this.catalogClient.getEntityByRef(
        stringifyEntityRef(entity),
      );
      const ownerRefs =
        multisigFromApi && multisigFromApi.relations
          ? multisigFromApi.relations
              .filter(r => r.type === RELATION_OWNED_BY)
              .map(r => parseEntityRef(r.targetRef))
          : [];
      logger.debug(`${entity.metadata.name} owners: ${ownerRefs.length}`);

      for (const [k, r] of ownerRefs.entries()) {
        const owner = await this.catalogClient.getEntityByRef(r);
        if (owner && isResourceEntity(owner) && isSigner(owner)) {
          logger.debug(
            `${entity.metadata.name} owner ${k} => ${owner.metadata.namespace}`,
          );
          owners.push(owner);
        }
      }
    } catch (error) {
      logger.warn(`${entity.metadata.name} failed to get owners`);
    }

    const hasAllowUnknown = entity.metadata.tags
      ? entity.metadata.tags.some(tag => tag === 'allow-unknown')
      : false;

    const needsPolicyCheck = !hasAllowUnknown && owners.length > 0;
    if (needsPolicyCheck) {
      const hasUnknown = owners.some(
        owner => owner?.metadata.namespace === 'stub',
      );
      logger.info(`${entity.metadata.name} Policy Check => ${!hasUnknown}`);
      if (hasUnknown) {
        this.appendTags(entity, 'has-unknown');
      }
    }
    return entity;
  }

  private async processNearContract(entity: Entity) {
    const logger = this.logger.child({ component: 'near-contract-check' });

    let hasAllowUnknown = false;
    const accessKeys = [];
    try {
      const contractFromApi = await this.catalogClient.getEntityByRef(
        stringifyEntityRef(entity),
      );
      if (!contractFromApi) return entity;

      hasAllowUnknown = contractFromApi.metadata.tags
        ? contractFromApi.metadata.tags.some(tag => tag === 'allow-unknown')
        : false;

      const consumerRefs =
        contractFromApi && contractFromApi.relations
          ? contractFromApi.relations
              .filter(r => r.type === RELATION_API_CONSUMED_BY)
              .map(r => parseEntityRef(r.targetRef))
          : [];
      logger.debug(`${entity.metadata.name} consumers: ${consumerRefs.length}`);

      for (const [k, r] of consumerRefs.entries()) {
        const consumer = await this.catalogClient.getEntityByRef(r);
        if (consumer && isResourceEntity(consumer) && isAccessKey(consumer)) {
          logger.debug(
            `${entity.metadata.name} access-key ${k} => ${consumer.metadata.namespace}`,
          );
          accessKeys.push(consumer);
        }
      }
    } catch (error) {
      logger.warn(`${entity.metadata.name} failed to get access keys`);
    }

    const needsPolicyCheck = !hasAllowUnknown && accessKeys.length > 0;
    if (needsPolicyCheck) {
      const hasUnknown = accessKeys.some(
        accessKey => accessKey?.metadata.namespace === 'stub',
      );
      logger.info(`${entity.metadata.name} Policy Check => ${!hasUnknown}`);
      if (hasUnknown) {
        this.appendTags(entity, 'has-unknown');
      }
    }
    return entity;
  }

  private async processSignerOrAccessKey(entity: Entity) {
    const logger = this.logger.child({
      component: 'signer-or-access-key-check',
    });
    logger.debug(
      `${entity.metadata.name} namespace: ${entity.metadata.namespace}`,
    );
    try {
      const entityFromApi = await this.catalogClient.getEntityByRef(
        stringifyEntityRef(entity),
      );
      if (!entityFromApi) return entity;
      const hasAllowUnknown = entityFromApi.metadata.tags
        ? entityFromApi.metadata.tags.some(tag => tag === 'allow-unknown')
        : false;
      if (entity.metadata.namespace === 'stub' && !hasAllowUnknown) {
        this.appendTags(entity, 'unknown');
      }
    } catch (e) {
      logger.warn(`${entity.metadata.name} failed to get access keys`);
    }
    return entity;
  }
}

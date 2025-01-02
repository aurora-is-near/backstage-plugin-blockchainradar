import {
  CatalogProcessor,
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  Entity,
  EntityLink,
  RELATION_API_CONSUMED_BY,
  RELATION_API_PROVIDED_BY,
  RELATION_CONSUMES_API,
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
  RELATION_HAS_MEMBER,
  RELATION_MEMBER_OF,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  RELATION_PROVIDES_API,
  getCompoundEntityRef,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { CatalogClient } from '@backstage/catalog-client';
import { Config } from '@backstage/config';
import { JsonValue } from '@backstage/types';
import { CacheableSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { Mutex } from 'async-mutex';

import { TrackedRun } from '../lib/TrackedRun';
import { BlockchainradarEnvironment } from '../lib/types';
import { Address } from '../models/Address';
import { NearAccessKey } from '../models/NearAccessKey';

export abstract class BlockchainProcessor implements CatalogProcessor {
  static mutexes: Record<string, Mutex> = {};
  cacheTtlMinutes = 120;
  requestDelaySeconds = 1;

  catalogClient: CatalogClient;
  config: Config;
  logger: LoggerService;
  name: string;

  constructor(private readonly env: BlockchainradarEnvironment) {
    this.catalogClient = new CatalogClient({
      discoveryApi: this.env.discovery,
    });
    this.config = this.env.config.getConfig('blockchain');
    this.name = this.constructor.name;
    this.logger = this.env.logger.child({
      processor: this.name,
    });
  }

  public getProcessorName(): string {
    return this.name;
  }

  protected appendLink(entity: Entity, ...links: EntityLink[]) {
    if (!entity.metadata.links) {
      entity.metadata.links = [];
    }
    entity.metadata.links.push(...links);
  }

  protected appendTags(entity: Entity, ...tags: string[]) {
    if (!entity.metadata.tags) {
      entity.metadata.tags = [];
    }
    entity.metadata.tags.push(...tags);
  }

  protected async fetchCachedSpec<T extends JsonValue>(
    cache: CatalogProcessorCache,
    key = 'cached-spec',
  ) {
    return cache.get<T>(key);
  }

  protected isCacheUpToDate(cachedSpec?: CacheableSpec) {
    if (!cachedSpec) return false;

    const upToDate =
      (Date.now() - cachedSpec!.fetchDate) / 1000 / 60 < this.cacheTtlMinutes;
    return upToDate;
  }

  protected async setCachedSpec(
    cache: CatalogProcessorCache,
    spec: CacheableSpec,
  ) {
    await cache.set<CacheableSpec>('cached-spec', spec!);
  }

  protected async setScopedCachedSpec<T extends CacheableSpec = CacheableSpec>(
    key: string,
    cache: CatalogProcessorCache,
    spec: T,
  ) {
    await cache.set<T>(key, spec);
  }

  protected async runExclusive(
    what: string,
    addr: string,
    callback: (l: LoggerService) => Promise<void>,
  ) {
    const mutexName = this.name;

    if (!BlockchainProcessor.mutexes[mutexName]) {
      BlockchainProcessor.mutexes[mutexName] = new Mutex();
      this.logger.info(`created ${mutexName} mutex`);
    }

    const mutex = BlockchainProcessor.mutexes[mutexName];
    await mutex.runExclusive(async () => {
      await new TrackedRun(this, what, { addr }).executeWithRetry(3, callback);
    });
  }

  protected async delayRequest(seconds?: number) {
    await new Promise(resolve =>
      setTimeout(resolve, (seconds || this.requestDelaySeconds) * 1000),
    );
  }

  /**
   * Tries to find an existing non-stub entity in the catalog
   * ignores the role while searching
   *
   * If nothing found - sets the stub flag, otherwise returns the existing entity
   *
   * This is needed when e.g. an address is discovered on-chain
   * and we want to track it in the catalog,
   * but we don't know if it will be discovered and explicitly defined in
   * the yaml files (potentially at a later stage).
   *
   * If an entity is explicitly declared at a later stage, the old stubbed entity
   * will be garbage collected and replaced with the new one
   *
   * Only one location can "own" entities with the same name so creating
   * non-explicitly defined entities in the stub namespace is a way to avoid conflicts
   *
   */
  protected async stubOrFind(model: Address | NearAccessKey): Promise<Entity> {
    if ('publicKey' in model) {
      const entity = await this.catalogClient.getEntityByRef(
        model.getEntityRef(),
      );
      if (entity) {
        model.stub = false;
        this.logger.debug(`found ${entity.metadata.name} in the catalog`);
        return entity;
      }
    } else {
      const prevRole = model.role;
      for (const findRole of ['contract', 'signer']) {
        model.role = findRole;
        const entity = await this.catalogClient.getEntityByRef(
          model.getEntityRef(),
        );
        if (entity) {
          model.stub = false;
          this.logger.debug(`found ${entity.metadata.name} in the catalog`);
          return entity;
        }
      }
      // need to keep the prev role if entity is not defined somewhere else
      model.role = prevRole;
    }
    model.stub = true;
    return model.toEntity();
  }

  protected systemSpec(entity: Entity) {
    if (entity.spec?.system && typeof entity.spec.system === 'string') {
      const system = parseEntityRef(entity.spec.system, {
        defaultKind: 'system',
        defaultNamespace: 'default',
      });
      return stringifyEntityRef(system);
    }
    return undefined;
  }

  protected ownerSpec(entity: Entity) {
    if (entity.spec?.owner && typeof entity.spec.owner === 'string') {
      const owner = parseEntityRef(entity.spec.owner, {
        defaultKind: 'group',
        defaultNamespace: 'default',
      });
      return stringifyEntityRef(owner);
    }
    return stringifyEntityRef(entity);
  }

  protected emitRelationship(
    emit: CatalogProcessorEmit,
    relation: string,
    source: Entity,
    target: Entity,
  ) {
    const ALL_RELATION_PAIRS = [
      [RELATION_OWNER_OF, RELATION_OWNED_BY],
      [RELATION_API_PROVIDED_BY, RELATION_PROVIDES_API],
      [RELATION_DEPENDS_ON, RELATION_DEPENDENCY_OF],
      [RELATION_CONSUMES_API, RELATION_API_CONSUMED_BY],
      [RELATION_HAS_MEMBER, RELATION_MEMBER_OF],
    ];

    const pair = ALL_RELATION_PAIRS.find(p => p.includes(relation));
    if (!pair) throw Error(`can't find relationship pair for ${relation}`);

    const inv_rel = pair[0] === relation ? pair[1] : pair[0];

    const r1 = getCompoundEntityRef(source);
    const r2 = getCompoundEntityRef(target);

    this.logger.debug(`${r1.name} ${relation} ${r2.name}`);
    this.logger.debug(`${r2.name} ${inv_rel} ${r1.name}`);

    emit(processingResult.relation({ source: r1, type: relation, target: r2 }));
    emit(processingResult.relation({ source: r2, type: inv_rel, target: r1 }));
  }
}

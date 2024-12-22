import {
  CatalogProcessor,
  CatalogProcessorCache,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { CatalogClient } from '@backstage/catalog-client';
import { Config } from '@backstage/config';
import { JsonValue } from '@backstage/types';
import { CacheableSpec } from '@aurora-is-near/backstage-plugin-blockchainradar-common';
import { Mutex } from 'async-mutex';

import { BlockchainAddress } from '../entities/BlockchainAddress';
import { TrackedRun } from '../lib/TrackedRun';
import { BlockchainradarEnvironment } from '../lib/types';

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

  protected appendLink(entity: Entity, address: BlockchainAddress) {
    if (!entity.metadata!.links) {
      entity.metadata.links = [];
    }
    entity.metadata.links.push(address.toLink());
  }

  protected appendTags(entity: Entity, ...tags: string[]) {
    if (!entity.metadata.tags) {
      entity.metadata.tags = [];
    }
    entity.metadata.tags.push(...tags);
  }

  protected async emitActsOn(
    address: BlockchainAddress,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
    tags: string[] = [],
    emitIfStubbed = true,
  ) {
    const entity = await address.stubOrFind(this.catalogClient);
    address.emitActsOn(emit);

    if (emitIfStubbed && address.stub) {
      if (tags.length > 0) {
        this.appendTags(entity, ...tags);
      }

      emit(processingResult.entity(location, entity));
    }
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
}

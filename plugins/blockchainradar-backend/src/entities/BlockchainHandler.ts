import {
  Entity,
  stringifyEntityRef,
  RELATION_DEPENDS_ON,
  RELATION_PROVIDES_API,
  RELATION_DEPENDENCY_OF,
  RELATION_API_PROVIDED_BY,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  RELATION_CONSUMES_API,
  RELATION_API_CONSUMED_BY,
  RELATION_HAS_MEMBER,
  RELATION_MEMBER_OF,
  getCompoundEntityRef,
  parseEntityRef,
  EntityMeta,
} from '@backstage/catalog-model';

import {
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';

import { CatalogClient } from '@backstage/catalog-client';
import { BlockchainProcessor } from '../processors/BlockchainProcessor';
import { LoggerService } from '@backstage/backend-plugin-api/index';

/**
 * This is a parent for all entities generated by the plugin.
 */
export abstract class BlockchainHandler {
  /*
      *Roles*
    
      Used to differentiate entities of the same type.
      Used only for cosmetic purposes.
      Primarily used for grouping / filtering in the UI.
      If entity's role is defined in multiple places, the role is randomly chosen.
      */
  role: string; // contract | admin | signer | etc

  // Parent entity is used to inherit the ownership and other metadata
  parent: Entity;

  // Entities can only be used inside of processors and require
  // processor config to operate
  processor: BlockchainProcessor;

  /**
   *  *Stubbable entities*
   *
   *  Entity is stubbed when it is automatically discovered by the plugin on-chain
   *  and it is not explicitly defined as a part of the catalog.
   *
   *  If the stubbable entity is first discovered on-chain and then discovered
   *  again in the catalog, it will be replaced with the entity from the catalog.
   *
   *  Stubbed entities have "stub" tag and are marked withk "*" prefix in the title.
   *  They are located in the stub namespaces - that's why they can be replaced with
   *  explicitly defined entities in the catalog.
   */
  stub = false;
  logger: LoggerService;

  constructor(processor: BlockchainProcessor, parent: Entity, role: string) {
    this.processor = processor;
    this.parent = parent;
    this.role = role;
    this.logger = processor.logger.child({ handler: this.constructor.name });
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
  async stubOrFind(catalogClient: CatalogClient): Promise<Entity> {
    const stubRole = this.role;
    for (const findRole of ['api', 'contract', 'resource']) {
      this.role = findRole;
      const entity = await catalogClient.getEntityByRef(this.entityRef());
      if (entity) {
        this.stub = false;
        this.logger.debug(`found ${entity.metadata.name} in the catalog`);
        return entity;
      }
      // need to keep the stub role if entity is not defined somewhere else
      this.role = stubRole;
    }
    this.stub = true;
    return this.toEntity();
  }

  abstract entityName(): string;
  abstract entityTitle(): string;

  entityNamespace() {
    return this.stub ? 'stub' : 'default';
  }

  entityRef() {
    const kind =
      this.role === 'contract' || this.role === 'role-group'
        ? 'api'
        : 'resource';
    return `${kind}:${this.entityNamespace()}/${this.entityName()}`;
  }

  entityLifecycle() {
    return 'production';
  }

  emitRelationship(
    rel: string,
    emit: CatalogProcessorEmit,
    destination?: Entity,
  ) {
    // can't use frontend components on the backend
    // https://github.com/backstage/backstage/blob/master/plugins/catalog-graph/src/components/EntityRelationsGraph/relations.ts
    const ALL_RELATION_PAIRS = [
      [RELATION_OWNER_OF, RELATION_OWNED_BY],
      [RELATION_API_PROVIDED_BY, RELATION_PROVIDES_API],
      [RELATION_DEPENDS_ON, RELATION_DEPENDENCY_OF],
      [RELATION_CONSUMES_API, RELATION_API_CONSUMED_BY],
      [RELATION_HAS_MEMBER, RELATION_MEMBER_OF],
    ];

    if (destination === undefined) destination = this.parent;

    const pair = ALL_RELATION_PAIRS.find(p => p.includes(rel));
    if (!pair) throw Error(`can't find relationship pair for ${rel}`);

    const inv_rel = pair[0] === rel ? pair[1] : pair[0];

    const r1 = getCompoundEntityRef(this.toEntity());
    const r2 = getCompoundEntityRef(destination);

    // console.log(r1);
    // console.log(r2);

    this.logger.debug(`${r1.name} ${rel} ${r2.name}`);
    this.logger.debug(`${r2.name} ${inv_rel} ${r1.name}`);

    emit(processingResult.relation({ source: r1, type: rel, target: r2 }));
    emit(processingResult.relation({ source: r2, type: inv_rel, target: r1 }));
  }

  emitDeployedBy(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_API_PROVIDED_BY, emit, destination);
  }

  emitActsOn(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_CONSUMES_API, emit, destination);
  }

  emitSignerOf(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_OWNER_OF, emit, destination);
  }

  emitOwnedBy(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_OWNED_BY, emit, destination);
  }

  emitDependencyOf(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_DEPENDENCY_OF, emit, destination);
  }

  emitDependencyOn(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_DEPENDS_ON, emit, destination);
  }

  emitHasMember(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_HAS_MEMBER, emit, destination);
  }

  emitMemberOf(emit: CatalogProcessorEmit, destination?: Entity) {
    this.emitRelationship(RELATION_MEMBER_OF, emit, destination);
  }

  ownerSpec() {
    if (this.parent.spec!.owner) {
      const owner = parseEntityRef(this.parent.spec!.owner as string, {
        defaultKind: 'group',
        defaultNamespace: 'default',
      });
      return stringifyEntityRef(owner);
    }
    // needed for user owning addresses
    return stringifyEntityRef(this.parent);
  }

  systemSpec() {
    if (this.parent.spec!.system) {
      const system = parseEntityRef(this.parent.spec!.system as string, {
        defaultKind: 'system',
        defaultNamespace: 'default',
      });
      return { system: stringifyEntityRef(system) };
    }
    // needed for user owning addresses
    return {};
  }

  inheritedSpec() {
    // system page gets polluted with low-level child entities
    // limiting it only to the most important ones
    if (['contract', 'admin', 'multisig'].includes(this.role)) {
      return {
        ...this.systemSpec(),
        owner: this.ownerSpec(),
        lifecycle: this.entityLifecycle(),
        dependencyOf: [stringifyEntityRef(this.parent)],
      };
    }
    return {
      owner: this.ownerSpec(),
      lifecycle: this.entityLifecycle(),
    };
  }

  entitySpec(): Entity['spec'] {
    return {
      type: this.role,
      ...this.inheritedSpec(),
    };
  }

  inheritedTags() {
    const inheritableTags = ['allow-unknown'];
    return (this.parent.metadata.tags || []).filter(t =>
      inheritableTags.includes(t),
    );
  }

  entityTags() {
    return this.inheritedTags();
  }

  entityMetadata(): EntityMeta {
    return {
      name: this.entityName(),
      namespace: this.entityNamespace(),
      title: this.entityTitle(),
      tags: this.entityTags(),
      annotations: this.parent.metadata.annotations,
    };
  }

  abstract toEntity(): Entity;
}

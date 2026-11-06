import { USER_ENTITY_ID, defaultGraphQL, defaultMultitenancy, defaultQueues, defaultThrottling, defaultUploads, defaultWebSockets } from "../model/defaults";
import { buildDerivedInverses } from "../model/normalize";
import type { CustomEndpointDef, EntityDef, FieldDef, Project, RelationDef } from "../model/schema";
import { toPascalCase } from "../model/naming";
import { GENERATOR_VERSION } from "../version";
import { entityNames, fieldColumnName, manyToManyTableName, relationFkName, relationJoinColumnPair } from "./naming";
import { mapFieldType } from "./type-map";
import type {
  CustomEndpointIR,
  DerivedRelationIR,
  EntityIR,
  EnumIR,
  FieldIR,
  ProjectIR,
  RelationIR,
} from "./types";

export class IrBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IrBuildError";
  }
}

function enumMembers(values: string[]): string[] {
  const used = new Set<string>();
  return values.map((value, index) => {
    const base = toPascalCase(value) || `Value${index + 1}`;
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}${suffix}`;
      suffix += 1;
    }
    used.add(name);
    return name;
  });
}

function buildEnums(project: Project): EnumIR[] {
  return project.enums.map((definition) => ({
    id: definition.id,
    name: definition.name,
    values: definition.values,
    members: enumMembers(definition.values),
    definition,
  }));
}

function implicitPrimary(): FieldDef {
  return {
    id: "fld_implicit_primary",
    name: "id",
    type: "uuid",
    required: true,
    unique: true,
    indexed: false,
    primary: true,
  };
}

function buildField(field: FieldDef, project: Project, enumById: Map<string, EnumIR>): FieldIR {
  const enumIR = field.enumId ? enumById.get(field.enumId) : undefined;
  if (field.type === "enum" && !enumIR) {
    throw new IrBuildError(`Field ${field.name} references a missing enum.`);
  }

  const mapping = mapFieldType(field, project.driver, enumIR?.name);
  return {
    definition: field,
    id: field.id,
    name: field.name,
    type: field.type,
    required: field.required,
    unique: field.unique,
    indexed: field.indexed,
    primary: field.primary,
    defaultValue: field.defaultValue,
    columnName: fieldColumnName(field.name),
    tsType: mapping.tsType,
    enum: enumIR,
    generated: false,
  };
}

function assertUnique(values: Array<{ value: string; label: string }>, what: string): void {
  const seen = new Map<string, string>();
  for (const { value, label } of values) {
    const existing = seen.get(value);
    if (existing) {
      throw new IrBuildError(`${existing} and ${label} share the same ${what} (${value}).`);
    }
    seen.set(value, label);
  }
}

function buildCustomEndpoint(definition: CustomEndpointDef): CustomEndpointIR {
  const routePath = definition.path.replace(/^\/+/, "");
  const hasIdParam = /(^|\/):id(\/|$)/.test(definition.path);
  return {
    definition,
    id: definition.id,
    name: definition.name,
    method: definition.method,
    path: definition.path,
    routePath,
    description: definition.description,
    access: definition.access,
    hasIdParam,
    throttle: definition.throttle,
    skipThrottle: definition.skipThrottle,
    cache: definition.cache,
  };
}

function buildEntityShell(
  definition: EntityDef,
  project: Project,
  enumById: Map<string, EnumIR>,
): EntityIR {
  const names = entityNames(definition);
  const fields = definition.fields.map((field) => buildField(field, project, enumById));
  const explicitPrimary = fields.find((field) => field.primary);
  const implicit = explicitPrimary === undefined;
  const primaryDef = implicit ? implicitPrimary() : undefined;
  const primary = primaryDef
    ? buildField(primaryDef, project, enumById)
    : (explicitPrimary as FieldIR);

  if (implicit) primary.generated = true;
  const allFields = implicit ? [primary, ...fields] : fields;
  const isSystem = definition.id === USER_ENTITY_ID;
  const timestamps = isSystem || definition.options.timestamps;
  const softDelete = isSystem || definition.options.softDelete;
  const multitenant = !isSystem && Boolean(project.settings.multitenancy?.enabled && definition.options.multitenant);

  return {
    definition,
    id: definition.id,
    ...names,
    fields: allFields,
    primary,
    implicitPrimary: implicit,
    relations: [],
    derivedRelations: [],
    ownerRelation: undefined,
    ownerColumn: undefined,
    timestamps,
    softDelete,
    multitenant,
    throttle: definition.options.throttle,
    cache: definition.options.cache,
    options: {
      ...definition.options,
      searchFields: [...definition.options.searchFields],
      sortFields: [...definition.options.sortFields],
    },
    access: definition.access,
    customEndpoints: (definition.customEndpoints ?? []).map(buildCustomEndpoint),
    isSystem,
  };
}

function relationFkType(target: EntityIR): "string" | "number" {
  return target.primary.type === "int" ? "number" : "string";
}

function buildRelation(
  definition: RelationDef,
  entity: EntityIR,
  entityById: Map<string, EntityIR>,
  inverseByRelationId: Map<string, { name: string; kind: RelationIR["kind"] }>,
): RelationIR {
  const target = entityById.get(definition.targetEntityId);
  if (!target) throw new IrBuildError(`Relation ${definition.name} targets a missing entity.`);
  if (definition.kind === "one-to-many") {
    throw new IrBuildError(
      `Relation ${entity.name}.${definition.name} is stored as one-to-many; use many-to-one on ${target.name} instead.`,
    );
  }

  const inverse = inverseByRelationId.get(definition.id);
  const owner = entity.options.owner && entity.options.ownerRelation === definition.name;
  const fkType = relationFkType(target);
  const relation: RelationIR = {
    definition,
    id: definition.id,
    name: definition.name,
    kind: definition.kind,
    target,
    nullable: definition.nullable,
    cascade: definition.cascade,
    owner,
    fkType,
    inverseName: inverse?.name,
    inverseKind: inverse?.kind,
  };

  if (definition.kind === "many-to-one" || definition.kind === "one-to-one") {
    relation.fkName = relationFkName(definition.name);
  }

  if (definition.kind === "many-to-many") {
    const pair = relationJoinColumnPair(entity, target);
    relation.joinTableName = manyToManyTableName(entity.definition, target.definition);
    relation.joinColumnName = pair.joinColumnName;
    relation.inverseJoinColumnName = pair.inverseJoinColumnName;
  }

  return relation;
}

function assertGeneratedNames(entity: EntityIR): void {
  const used = new Map<string, string>();
  for (const field of entity.fields) used.set(field.name, `field ${field.name}`);
  for (const relation of entity.relations) used.set(relation.name, `relation ${relation.name}`);

  const generated: string[] = [];
  if (entity.timestamps) generated.push("createdAt", "updatedAt");
  if (entity.softDelete) generated.push("deletedAt");
  for (const name of generated) {
    const existing = used.get(name);
    if (existing) {
      throw new IrBuildError(
        `${entity.name} uses ${existing} but a generated column is also named ${name}. Rename the field or disable the generated column.`,
      );
    }
  }

  for (const relation of entity.relations) {
    if (!relation.fkName) continue;
    const existing = used.get(relation.fkName);
    if (existing) {
      throw new IrBuildError(
        `${entity.name}.${relation.name} needs a foreign key named ${relation.fkName}, but ${existing} already uses that name.`,
      );
    }
    used.set(relation.fkName, `foreign key ${relation.fkName}`);
    if (relation.owner) entity.ownerColumn = relation.fkName;
  }

  if (entity.options.owner && !entity.ownerRelation) {
    throw new IrBuildError(
      `${entity.name} has ownership enabled but no managed owner relation. Re-save its auth access settings.`,
    );
  }
}

export function buildIR(project: Project): ProjectIR {
  const enumById = new Map<string, EnumIR>();
  const enums = buildEnums(project);
  for (const enumIR of enums) enumById.set(enumIR.id, enumIR);

  const entityById = new Map<string, EntityIR>();
  const entities = project.entities.map((definition) =>
    buildEntityShell(definition, project, enumById),
  );
  for (const entity of entities) entityById.set(entity.id, entity);

  assertUnique(
    entities.map((entity) => ({ value: entity.restPath, label: `REST path of ${entity.name}` })),
    "REST path",
  );
  assertUnique(
    entities.map((entity) => ({ value: entity.tableName, label: `table of ${entity.name}` })),
    "table name",
  );
  assertUnique(
    entities.map((entity) => ({ value: entity.singularKebab, label: `module of ${entity.name}` })),
    "module folder",
  );

  const inverses = buildDerivedInverses(project.entities);
  const inverseByRelationId = new Map(
    inverses.map((inverse) => [inverse.relationId, { name: inverse.name, kind: inverse.kind }]),
  );

  for (const entity of entities) {
    entity.relations = entity.definition.relations.map((definition) =>
      buildRelation(definition, entity, entityById, inverseByRelationId),
    );
    if (entity.options.owner) {
      entity.ownerRelation = entity.relations.find(
        (relation) => relation.name === entity.options.ownerRelation,
      );
    }
    assertGeneratedNames(entity);
  }

  for (const inverse of inverses) {
    const target = entityById.get(inverse.targetEntityId);
    const source = entityById.get(inverse.sourceEntityId);
    if (!target || !source) continue;
    const sourceRelation = source.relations.find((relation) => relation.id === inverse.relationId);
    if (!sourceRelation) continue;
    const derived: DerivedRelationIR = {
      name: inverse.name,
      kind: inverse.kind,
      source,
      sourceRelation,
    };
    target.derivedRelations.push(derived);
  }

  for (const entity of entities) {
    const fieldByName = new Map(entity.fields.map((field) => [field.name, field]));
    entity.options.searchFields = entity.options.searchFields.filter((name) => fieldByName.has(name));
    entity.options.sortFields = entity.options.sortFields.filter((name) => fieldByName.has(name));
  }

  const auth = {
    ...project.auth,
    adminRole: project.auth.roles.some((role) => role.key === "admin") ? "admin" : project.auth.roles[0].key,
    defaultRole: project.auth.roles.some((role) => role.key === "user") ? "user" : project.auth.roles[0].key,
  };

  return {
    project,
    generatorVersion: GENERATOR_VERSION,
    name: project.name,
    packageName: project.packageName,
    driver: project.driver,
    apiPrefix: project.settings.apiPrefix,
    auth,
    uploads: project.settings.uploads ?? defaultUploads(),
    multitenancy: project.settings.multitenancy ?? defaultMultitenancy(),
    throttling: project.settings.throttling ?? defaultThrottling(),
    graphql: project.settings.graphql ?? defaultGraphQL(),
    queues: project.settings.queues ?? defaultQueues(),
    websockets: project.settings.websockets ?? defaultWebSockets(),
    enums,
    entities,
    user: entityById.get(USER_ENTITY_ID),
    enumById,
    entityById,
  };
}

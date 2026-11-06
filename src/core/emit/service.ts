import type { EntityIR, ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import {
  ACCESS_PATH,
  PAGINATED_RESPONSE_PATH,
  entityDtoPath,
  entityFilePath,
  entityServicePath,
  file,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";
import {
  accessUsesOwner,
  idType,
  scopeLine,
  buildFindAll,
  buildFindOne,
  buildWriteLookup,
  assignmentLines,
  manyToManyLines,
  ownerCreateLine,
  emitBroadcastEvent,
  buildCustomEndpointStubs,
  buildDerivedOneToManyMethods,
} from "./service-query";

export function emitService(ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityServicePath(entity);
  const registry = new ImportRegistry();
  const oneToManyDerived = entity.derivedRelations.filter(
    (derived) => derived.kind === "one-to-many" && !derived.source.isSystem,
  );
  const hasManyToMany = entity.relations.some((relation) => relation.kind === "many-to-many");
  const hasOneToMany = oneToManyDerived.length > 0;
  const needsIn =
    hasManyToMany ||
    oneToManyDerived.some((d) => d.source.relations.some((r) => r.kind === "many-to-many"));

  registry.add("@nestjs/common", "BadRequestException", "Injectable", "NotFoundException");
  registry.add("@nestjs/typeorm", "InjectRepository");
  const typeormImports = ["Repository"];
  if (hasManyToMany || hasOneToMany) typeormImports.push("DataSource");
  if (needsIn) typeormImports.push("In");
  registry.add("typeorm", ...typeormImports);

  registry.add(sourceImport(path, entityFilePath(entity)), entity.name);
  registry.add(sourceImport(path, entityDtoPath(entity, "create")), `Create${entity.name}Dto`);
  registry.add(sourceImport(path, entityDtoPath(entity, "update")), `Update${entity.name}Dto`);
  registry.add(sourceImport(path, entityDtoPath(entity, "query")), `Query${entity.name}Dto`);
  registry.add(sourceImport(path, PAGINATED_RESPONSE_PATH), "PaginatedResponse");
  const accessImports = ["AuthUser"];
  if (entity.multitenant) accessImports.push("applyTenantScope");
  if (entity.softDelete && ir.auth.enabled) accessImports.push("isAdmin");
  if (
    ir.auth.enabled &&
    (accessUsesOwner(entity, "list") ||
      accessUsesOwner(entity, "read") ||
      accessUsesOwner(entity, "update") ||
      accessUsesOwner(entity, "delete"))
  ) {
    accessImports.push("applyAccessScope");
  }
  registry.add(sourceImport(path, ACCESS_PATH), ...accessImports);
  for (const relation of entity.relations) {
    if (relation.kind === "many-to-many") {
      registry.add(sourceImport(path, entityFilePath(relation.target)), relation.target.name);
    }
  }

  for (const derived of oneToManyDerived) {
    const child = derived.source;
    registry.add(sourceImport(path, entityFilePath(child)), child.name);
    registry.add(sourceImport(path, entityDtoPath(child, "create")), `Create${child.name}Dto`);
    registry.add(sourceImport(path, entityDtoPath(child, "query")), `Query${child.name}Dto`);
    if (child.multitenant && !entity.multitenant) {
      registry.add(sourceImport(path, ACCESS_PATH), "applyTenantScope");
    }
    if (child.softDelete && ir.auth.enabled) {
      registry.add("@nestjs/common", "ForbiddenException");
      registry.add(sourceImport(path, ACCESS_PATH), "isAdmin");
    }
    if (ir.auth.enabled && accessUsesOwner(child, "list")) {
      registry.add(sourceImport(path, ACCESS_PATH), "applyAccessScope");
    }
    for (const relation of child.relations) {
      if (relation.kind === "many-to-many") {
        registry.add(sourceImport(path, entityFilePath(relation.target)), relation.target.name);
      }
    }
  }

  if (entity.softDelete && ir.auth.enabled) registry.add("@nestjs/common", "ForbiddenException");

  const broadcastCrud = ir.websockets?.enabled && ir.websockets?.broadcastCrud;
  if (broadcastCrud) {
    registry.add("@nestjs/common", "Optional");
    registry.add(sourceImport(path, "src/events/events.gateway.ts"), "EventsGateway");
  }

  const lines: string[] = [];
  const tenantParam = entity.multitenant ? "tenantId: string, " : "";
  const tenantArg = entity.multitenant ? "tenantId, " : "";

  lines.push("@Injectable()");
  lines.push(`export class ${entity.name}Service {`);
  lines.push("  constructor(");
  lines.push(`    @InjectRepository(${entity.name}) private readonly repository: Repository<${entity.name}>,`);
  if (hasManyToMany || hasOneToMany) {
    lines.push("    private readonly dataSource: DataSource,");
  }
  if (broadcastCrud) {
    lines.push("    @Optional() private readonly eventsGateway?: EventsGateway,");
  }
  lines.push("  ) {}");
  lines.push("");
  lines.push(...buildFindAll(entity, ir));
  lines.push("");
  lines.push(...buildFindOne(entity, ir));
  lines.push("");
  lines.push(...buildWriteLookup(entity, ir, "findForUpdate", "update"));
  lines.push("");
  lines.push(...buildWriteLookup(entity, ir, "findForDelete", "delete"));
  lines.push("");
  lines.push(`  async create(dto: Create${entity.name}Dto, ${tenantParam}user?: AuthUser): Promise<${entity.name}> {`);
  lines.push(`    const entity = this.repository.create();`);
  lines.push(...assignmentLines(entity, "create"));
  if (entity.multitenant) {
    lines.push("    entity.tenantId = tenantId;");
  }
  lines.push(...ownerCreateLine(entity, ir));
  lines.push(...manyToManyLines(entity, "create"));
  if (broadcastCrud) {
    lines.push("    const saved = await this.repository.save(entity);");
    lines.push(emitBroadcastEvent("created", entity.name, entity.multitenant, "saved"));
    lines.push("    return saved;");
  } else {
    lines.push("    return this.repository.save(entity);");
  }
  lines.push("  }");
  lines.push("");
  lines.push(`  async update(id: ${idType(entity)}, dto: Update${entity.name}Dto, ${tenantParam}user?: AuthUser): Promise<${entity.name}> {`);
  lines.push(`    const entity = await this.findForUpdate(id, ${tenantArg}user);`);
  lines.push(...assignmentLines(entity, "update"));
  lines.push(...manyToManyLines(entity, "update"));
  if (broadcastCrud) {
    lines.push("    const saved = await this.repository.save(entity);");
    lines.push(emitBroadcastEvent("updated", entity.name, entity.multitenant, "saved"));
    lines.push("    return saved;");
  } else {
    lines.push("    return this.repository.save(entity);");
  }
  lines.push("  }");
  lines.push("");
  lines.push(`  async remove(id: ${idType(entity)}, ${tenantParam}user?: AuthUser): Promise<void> {`);
  lines.push(`    const entity = await this.findForDelete(id, ${tenantArg}user);`);
  if (entity.softDelete) {
    lines.push("    await this.repository.softRemove(entity);");
  } else {
    lines.push("    await this.repository.remove(entity);");
  }
  if (broadcastCrud) {
    lines.push(emitBroadcastEvent("deleted", entity.name, entity.multitenant, "{ id }"));
  }
  lines.push("  }");

  if (entity.softDelete) {
    lines.push("");
    lines.push(`  async restore(id: ${idType(entity)}, ${tenantParam}user?: AuthUser): Promise<void> {`);
    lines.push(`    const qb = this.repository.createQueryBuilder("${entity.name.toLowerCase()}")`);
    lines.push(`      .withDeleted()`);
    lines.push(`      .where("${entity.name.toLowerCase()}.${entity.primary.name} = :id", { id })`);
    lines.push(`      .andWhere("${entity.name.toLowerCase()}.deletedAt IS NOT NULL");`);
    lines.push(...scopeLine(entity, ir, "delete"));
    lines.push("    const entity = await qb.getOne();");
    lines.push(`    if (!entity) throw new NotFoundException("${entity.name} not found");`);
    lines.push(`    await this.repository.restore(id);`);
    lines.push("  }");
  }

  for (const derived of oneToManyDerived) {
    lines.push("");
    lines.push(...buildDerivedOneToManyMethods(entity, derived, ir));
  }

  lines.push(...buildCustomEndpointStubs(entity));

  lines.push("}");
  const content = `${registry.render()}${lines.join("\n")}\n`;
  return file(path, content);
}

export function emitServices(ir: ProjectIR): GeneratedFile[] {
  return ir.entities
    .filter((entity) => !entity.isSystem)
    .map((entity) => emitService(ir, entity));
}

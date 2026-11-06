import type { EntityIR, FieldIR, ProjectIR } from "../ir/types";
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

function queryFilterFields(entity: EntityIR): FieldIR[] {
  const reserved = new Set(["page", "limit", "search", "sort", "order"]);
  return entity.fields.filter(
    (field) => !field.primary && field.type !== "json" && !reserved.has(field.name),
  );
}

function accessUsesOwner(entity: EntityIR, operation: "list" | "read" | "update" | "delete"): boolean {
  return entity.access[operation].level === "owner";
}

function ownerColumn(entity: EntityIR): string {
  return entity.ownerColumn ?? "ownerId";
}

function idType(entity: EntityIR): string {
  return entity.primary.tsType;
}

function textSearchFields(entity: EntityIR): FieldIR[] {
  const names =
    entity.options.searchFields.length > 0
      ? entity.options.searchFields
      : entity.fields
          .filter((field) => field.type === "string" || field.type === "text")
          .map((field) => field.name);

  const seen = new Set<string>();
  const fields: FieldIR[] = [];
  for (const name of names) {
    const field = entity.fields.find((candidate) => candidate.name === name);
    if (!field || (field.type !== "string" && field.type !== "text") || seen.has(field.name)) {
      continue;
    }
    seen.add(field.name);
    fields.push(field);
  }
  return fields;
}

function searchClause(entity: EntityIR, ir: ProjectIR, alias: string): string {
  const fields = textSearchFields(entity);
  if (fields.length === 0) return "";
  const operator = ir.driver === "postgres" ? "ILIKE" : "LIKE";
  return fields
    .map((field) => `${alias}.${field.name} ${operator} :search`)
    .join(" OR ");
}

function filterLines(alias: string, field: FieldIR, ir: ProjectIR): string[] {
  const text = field.type === "string" || field.type === "text";
  const operator = text ? (ir.driver === "postgres" ? "ILIKE" : "LIKE") : "=";
  const value = text ? `\`%\${query.${field.name}}%\`` : `query.${field.name}`;
  const lines = [
    `    if (query.${field.name} !== undefined) qb.andWhere("${alias}.${field.name} ${operator} :${field.name}", { ${field.name}: ${value} });`,
  ];
  if (!text && field.type !== "boolean" && field.type !== "uuid" && field.type !== "enum" && field.type !== "json") {
    lines.push(
      `    if (query.${field.name}Gte !== undefined) qb.andWhere("${alias}.${field.name} >= :${field.name}Gte", { ${field.name}Gte: query.${field.name}Gte });`,
    );
    lines.push(
      `    if (query.${field.name}Lte !== undefined) qb.andWhere("${alias}.${field.name} <= :${field.name}Lte", { ${field.name}Lte: query.${field.name}Lte });`,
    );
  }
  return lines;
}

function sortField(entity: EntityIR): string {
  if (entity.options.sortFields.length > 0) return entity.options.sortFields[0];
  if (entity.timestamps) return "createdAt";
  return entity.primary.name;
}

function assignmentLines(
  entity: EntityIR,
  mode: "create" | "update",
): string[] {
  const lines: string[] = [];
  for (const field of entity.fields) {
    if (field.primary) continue;
    const optional = field.defaultValue !== undefined || !field.required || mode === "update";
    const value =
      field.type === "date" || field.type === "datetime"
        ? `dto.${field.name} === null ? null : new Date(dto.${field.name})`
        : `dto.${field.name}`;
    const assignment = `entity.${field.name} = ${value};`;
    lines.push(optional ? `    if (dto.${field.name} !== undefined) ${assignment}` : `    ${assignment}`);
  }

  for (const relation of entity.relations) {
    if (!relation.fkName || relation.owner) continue;
    const optional = relation.nullable || mode === "update";
    const assignment = `entity.${relation.fkName} = dto.${relation.fkName};`;
    lines.push(optional ? `    if (dto.${relation.fkName} !== undefined) ${assignment}` : `    ${assignment}`);
  }
  return lines;
}

function manyToManyLines(entity: EntityIR, mode: "create" | "update"): string[] {
  return entity.relations
    .filter((relation) => relation.kind === "many-to-many")
    .flatMap((relation) => {
      const property = `${relation.name}Ids`;
      const condition = mode === "create" ? `dto.${property}` : `dto.${property} !== undefined`;
      const target = relation.target.name;
      return [
        `    if (${condition}) {`,
        `      entity.${relation.name} = await this.dataSource.getRepository(${target}).findBy({ ${relation.target.primary.name}: In(dto.${property}) });`,
        "    }",
      ];
    });
}

function ownerCreateLine(entity: EntityIR, ir: ProjectIR): string[] {
  if (!entity.ownerColumn || !ir.auth.enabled) return [];
  return [`    if (user) entity.${entity.ownerColumn} = user.id;`];
}

function scopeLine(entity: EntityIR, ir: ProjectIR, operation: "list" | "read" | "update" | "delete"): string[] {
  const lines: string[] = [];
  if (entity.multitenant) {
    lines.push("    applyTenantScope(qb, tenantId);");
  }
  if (ir.auth.enabled && accessUsesOwner(entity, operation)) {
    lines.push(`    applyAccessScope(qb, user, "${ownerColumn(entity)}", "${ir.auth.adminRole}");`);
  }
  return lines;
}

function selectLine(entity: EntityIR, alias: string): string {
  const columns = new Set<string>();
  for (const field of entity.fields) columns.add(field.name);
  if (entity.multitenant) columns.add("tenantId");
  if (entity.timestamps) {
    columns.add("createdAt");
    columns.add("updatedAt");
  }
  if (entity.softDelete) columns.add("deletedAt");
  for (const relation of entity.relations) {
    if (relation.fkName) columns.add(relation.fkName);
  }
  return `    qb.select([${[...columns].map((name) => JSON.stringify(`${alias}.${name}`)).join(", ")}]);`;
}

function buildFindAll(entity: EntityIR, ir: ProjectIR): string[] {
  const lines: string[] = [];
  const filters = queryFilterFields(entity);
  const alias = entity.name.toLowerCase();
  const search = searchClause(entity, ir, alias);
  const paginated = entity.options.pagination;
  const tenantParam = entity.multitenant ? "tenantId: string, " : "";

  lines.push(
    `  async findAll(query: Query${entity.name}Dto, ${tenantParam}user?: AuthUser): Promise<${paginated ? `PaginatedResponse<${entity.name}>` : `${entity.name}[]`}> {`,
  );
  lines.push(`    const qb = this.repository.createQueryBuilder("${alias}");`);
  lines.push(...scopeLine(entity, ir, "list"));
  lines.push(selectLine(entity, alias));

  if (entity.softDelete) {
    if (ir.auth.enabled) {
      lines.push("    if (query.withDeleted) {");
      lines.push(
        `      if (!isAdmin(user, ${JSON.stringify(ir.auth.adminRole)})) throw new ForbiddenException("Only administrators can include deleted rows");`,
      );
      lines.push("      qb.withDeleted();");
      lines.push("    }");
    } else {
      lines.push("    if (query.withDeleted) qb.withDeleted();");
    }
  }

  for (const field of filters) {
    lines.push(...filterLines(alias, field, ir));
  }

  if (search) {
    lines.push("    if (query.search) {");
    lines.push(`      qb.andWhere("(${search})", { search: \`%\${query.search}%\` });`);
    lines.push("    }");
  }

  const sortable = [
    entity.primary.name,
    ...(entity.timestamps ? ["createdAt", "updatedAt"] : []),
    ...entity.options.sortFields,
  ].filter((name, index, all) => all.indexOf(name) === index);

  lines.push(
    `    const sortable = new Set<string>([${sortable.map((name) => JSON.stringify(name)).join(", ")}]);`,
  );
  lines.push('    const requestedSort = query.sort?.replace(/^[-+]/, "");');
  lines.push("    if (requestedSort && !sortable.has(requestedSort)) {");
  lines.push("      throw new BadRequestException(`Invalid sort field: ${requestedSort}`);");
  lines.push("    }");
  lines.push(`    const sort = requestedSort ?? ${JSON.stringify(sortField(entity))};`);
  lines.push(
    '    const order = query.sort?.startsWith("-") ? "DESC" : query.sort?.startsWith("+") ? "ASC" : query.order === "ASC" ? "ASC" : "DESC";',
  );
  lines.push(`    qb.orderBy(\`${alias}.\${sort}\`, order);`);

  if (!paginated) {
    lines.push("    return qb.getMany();");
    lines.push("  }");
    return lines;
  }
  lines.push("");
  lines.push("    const page = query.page ?? 1;");
  lines.push("    const limit = query.limit ?? 20;");
  lines.push("    qb.skip((page - 1) * limit).take(limit);");
  lines.push("    const [data, total] = await qb.getManyAndCount();");
  lines.push(
    "    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };",
  );
  lines.push("  }");
  return lines;
}

function buildFindOne(entity: EntityIR, ir: ProjectIR): string[] {
  const alias = entity.name.toLowerCase();
  const lines: string[] = [];
  const tenantParam = entity.multitenant ? "tenantId: string, " : "";
  lines.push(`  async findOne(id: ${idType(entity)}, ${tenantParam}user?: AuthUser): Promise<${entity.name}> {`);
  lines.push(`    const qb = this.repository.createQueryBuilder("${alias}").where("${alias}.${entity.primary.name} = :id", { id });`);
  lines.push(...scopeLine(entity, ir, "read"));
  lines.push("    const entity = await qb.getOne();");
  lines.push(`    if (!entity) throw new NotFoundException("${entity.name} not found");`);
  lines.push("    return entity;");
  lines.push("  }");
  return lines;
}

function buildWriteLookup(
  entity: EntityIR,
  ir: ProjectIR,
  method: "findForUpdate" | "findForDelete",
  operation: "update" | "delete",
): string[] {
  const alias = entity.name.toLowerCase();
  const lines: string[] = [];
  const tenantParam = entity.multitenant ? "tenantId: string, " : "";
  lines.push(`  private async ${method}(id: ${idType(entity)}, ${tenantParam}user?: AuthUser): Promise<${entity.name}> {`);
  lines.push(`    const qb = this.repository.createQueryBuilder("${alias}").where("${alias}.${entity.primary.name} = :id", { id });`);
  lines.push(...scopeLine(entity, ir, operation));
  lines.push("    const entity = await qb.getOne();");
  lines.push(`    if (!entity) throw new NotFoundException("${entity.name} not found");`);
  lines.push("    return entity;");
  lines.push("  }");
  return lines;
}

function emitBroadcastEvent(
  action: "created" | "updated" | "deleted",
  entityName: string,
  isMultitenant: boolean,
  dataVar: string,
): string {
  const tenantArg = isMultitenant ? ", tenantId" : "";
  return `    this.eventsGateway?.emitEntityEvent("${entityName}", "${action}", ${dataVar}${tenantArg});`;
}

function buildCustomEndpointStubs(entity: EntityIR): string[] {
  const lines: string[] = [];
  const tenantParam = entity.multitenant ? "tenantId: string, " : "";
  for (const ep of entity.customEndpoints) {
    lines.push("");
    if (ep.hasIdParam) {
      lines.push(
        `  async ${ep.name}(id: ${idType(entity)}, ${tenantParam}user?: AuthUser): Promise<{ message: string }> {`,
      );
    } else {
      lines.push(`  async ${ep.name}(${tenantParam}user?: AuthUser): Promise<{ message: string }> {`);
    }
    lines.push(`    // TODO: Implement custom endpoint logic for ${ep.name}`);
    lines.push(`    return { message: "${ep.name} stub" };`);
    lines.push("  }");
  }
  return lines;
}

export function emitService(ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityServicePath(entity);
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "BadRequestException", "Injectable", "NotFoundException");
  registry.add("@nestjs/typeorm", "InjectRepository");
  registry.add(
    "typeorm",
    ...(entity.relations.some((relation) => relation.kind === "many-to-many")
      ? ["DataSource", "In", "Repository"]
      : ["Repository"]),
  );
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
  if (entity.relations.some((relation) => relation.kind === "many-to-many")) {
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

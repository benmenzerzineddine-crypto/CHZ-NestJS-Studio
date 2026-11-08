import type { DerivedRelationIR, EntityIR, FieldIR, ProjectIR, RelationIR } from "../ir/types";
import pluralize from "pluralize";
import { toPascalCase } from "../model/naming";

export function queryFilterFields(entity: EntityIR): FieldIR[] {
  const reserved = new Set(["page", "limit", "search", "sort", "order"]);
  return entity.fields.filter(
    (field) => !field.primary && field.type !== "json" && !reserved.has(field.name),
  );
}

export function accessUsesOwner(entity: EntityIR, operation: "list" | "read" | "update" | "delete"): boolean {
  return entity.access[operation].level === "owner";
}

export function ownerColumn(entity: EntityIR): string {
  return entity.ownerColumn ?? "ownerId";
}

export function idType(entity: EntityIR): string {
  return entity.primary.tsType;
}

export function textSearchFields(entity: EntityIR): FieldIR[] {
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

export function searchClause(entity: EntityIR, ir: ProjectIR, alias: string): string {
  const fields = textSearchFields(entity);
  if (fields.length === 0) return "";
  const operator = ir.driver === "postgres" ? "ILIKE" : "LIKE";
  return fields
    .map((field) => `${alias}.${field.name} ${operator} :search`)
    .join(" OR ");
}

export function filterLines(alias: string, field: FieldIR, ir: ProjectIR): string[] {
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

export function sortField(entity: EntityIR): string {
  if (entity.options.sortFields.length > 0) return entity.options.sortFields[0];
  if (entity.timestamps) return "createdAt";
  return entity.primary.name;
}

export function assignmentLines(
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

export function manyToManyLines(entity: EntityIR, mode: "create" | "update"): string[] {
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

export function ownerCreateLine(entity: EntityIR, ir: ProjectIR): string[] {
  if (!entity.ownerColumn || !ir.auth.enabled) return [];
  return [`    if (user) entity.${entity.ownerColumn} = user.id;`];
}

export function scopeLine(entity: EntityIR, ir: ProjectIR, operation: "list" | "read" | "update" | "delete"): string[] {
  const lines: string[] = [];
  if (entity.multitenant) {
    lines.push("    applyTenantScope(qb, tenantId);");
  }
  if (ir.auth.enabled && accessUsesOwner(entity, operation)) {
    lines.push(`    applyAccessScope(qb, user, "${ownerColumn(entity)}", "${ir.auth.adminRole}");`);
  }
  return lines;
}

export function selectLine(entity: EntityIR, alias: string): string {
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

export function buildFindAll(entity: EntityIR, ir: ProjectIR): string[] {
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

export function buildFindOne(entity: EntityIR, ir: ProjectIR): string[] {
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

export function buildWriteLookup(
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

export function emitBroadcastEvent(
  action: "created" | "updated" | "deleted",
  entityName: string,
  isMultitenant: boolean,
  dataVar: string,
): string {
  const tenantArg = isMultitenant ? ", tenantId" : "";
  return `    this.eventsGateway?.emitEntityEvent("${entityName}", "${action}", ${dataVar}${tenantArg});`;
}

export function buildCustomEndpointStubs(entity: EntityIR): string[] {
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

export function buildDerivedOneToManyMethods(
  entity: EntityIR,
  derived: DerivedRelationIR,
  ir: ProjectIR,
): string[] {
  const lines: string[] = [];
  const child = derived.source;
  const childFk = derived.sourceRelation.fkName ?? `${derived.sourceRelation.name}Id`;
  const alias = child.name.toLowerCase();
  const idTypeStr = idType(entity);
  const tenantParam = entity.multitenant ? "tenantId: string, " : "";
  const tenantArg = entity.multitenant ? "tenantId, " : "";
  const findMethodName = `find${toPascalCase(derived.name)}`;
  const singleName = pluralize.singular(derived.name);
  const createMethodName = `create${toPascalCase(singleName) || child.name}`;
  const paginated = child.options.pagination;
  const returnType = paginated ? `PaginatedResponse<${child.name}>` : `${child.name}[]`;

  // 1. Find method
  lines.push(
    `  async ${findMethodName}(id: ${idTypeStr}, query: Query${child.name}Dto, ${tenantParam}user?: AuthUser): Promise<${returnType}> {`,
  );
  lines.push(`    await this.findOne(id, ${tenantArg}user);`);
  lines.push(`    const qb = this.dataSource.getRepository(${child.name}).createQueryBuilder("${alias}");`);
  lines.push(`    qb.where("${alias}.${childFk} = :parentId", { parentId: id });`);

  const filters = queryFilterFields(child);
  for (const field of filters) {
    lines.push(...filterLines(alias, field, ir));
  }

  const search = searchClause(child, ir, alias);
  if (search) {
    lines.push("    if (query.search) {");
    lines.push(`      qb.andWhere("(${search})", { search: \`%\${query.search}%\` });`);
    lines.push("    }");
  }

  if (child.multitenant) {
    lines.push("    applyTenantScope(qb, tenantId);");
  }

  if (child.softDelete) {
    if (ir.auth.enabled) {
      lines.push("    if (query.withDeleted) {");
      lines.push(
        `      if (!isAdmin(user, ${JSON.stringify(ir.auth.adminRole)})) throw new ForbiddenException("Only administrators can include deleted rows");`,
      );
      lines.push("      qb.withDeleted();");
      lines.push("    }");
    }
  }

  if (ir.auth.enabled && accessUsesOwner(child, "list")) {
    lines.push(`    applyAccessScope(qb, user, "${ownerColumn(child)}", "${ir.auth.adminRole}");`);
  }

  const sort = sortField(child);
  lines.push(`    const sortOrder = query.order ?? "ASC";`);
  lines.push(`    qb.orderBy("${alias}.${sort}", sortOrder);`);

  if (paginated) {
    lines.push("    const page = Math.max(1, query.page ?? 1);");
    lines.push("    const limit = Math.min(100, Math.max(1, query.limit ?? 20));");
    lines.push("    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();");
    lines.push("    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };");
  } else {
    lines.push("    return qb.getMany();");
  }
  lines.push("  }");
  lines.push("");

  // 2. Create method
  lines.push(
    `  async ${createMethodName}(id: ${idTypeStr}, dto: Create${child.name}Dto, ${tenantParam}user?: AuthUser): Promise<${child.name}> {`,
  );
  lines.push(`    await this.findOne(id, ${tenantArg}user);`);
  lines.push(`    const repository = this.dataSource.getRepository(${child.name});`);
  lines.push(`    const entity = repository.create();`);
  lines.push(...assignmentLines(child, "create"));
  lines.push(`    entity.${childFk} = id;`);
  if (child.multitenant) {
    lines.push("    entity.tenantId = tenantId;");
  }
  lines.push(...ownerCreateLine(child, ir));
  lines.push(...manyToManyLines(child, "create"));
  lines.push(`    const saved = await repository.save(entity);`);
  const broadcastCrud = ir.websockets?.enabled && ir.websockets?.broadcastCrud;
  if (broadcastCrud) {
    lines.push(emitBroadcastEvent("created", child.name, entity.multitenant, "saved"));
  }
  lines.push("    return saved;");
  lines.push("  }");

  return lines;
}

export function buildManyToManyMethods(
  entity: EntityIR,
  relation: RelationIR,
  _ir: ProjectIR,
): string[] {
  const lines: string[] = [];
  const target = relation.target;
  const idTypeStr = idType(entity);
  const targetIdTypeStr = relation.fkType === "number" ? "number" : "string";
  const singleName = pluralize.singular(relation.name);
  const targetParamName = `${singleName}Id`;
  const findMethod = `find${toPascalCase(relation.name)}`;
  const attachMethod = `attach${toPascalCase(relation.name)}`;
  const detachMethod = `detach${toPascalCase(singleName)}`;
  const tenantParam = entity.multitenant ? "tenantId: string, " : "";
  const tenantArg = entity.multitenant ? "tenantId, " : "";
  const propName = `${singleName}Ids`;

  // 1. Find method: returns Target[]
  lines.push(
    `  async ${findMethod}(id: ${idTypeStr}, ${tenantParam}user?: AuthUser): Promise<${target.name}[]> {`,
  );
  lines.push(`    await this.findOne(id, ${tenantArg}user);`);
  lines.push(`    return this.repository.createQueryBuilder().relation("${relation.name}").of(id).loadMany();`);
  lines.push("  }");
  lines.push("");

  // 2. Attach method: adds ids and returns Target[]
  lines.push(
    `  async ${attachMethod}(id: ${idTypeStr}, dto: Attach${toPascalCase(relation.name)}Dto, ${tenantParam}user?: AuthUser): Promise<${target.name}[]> {`,
  );
  lines.push(`    await this.findOne(id, ${tenantArg}user);`);
  lines.push(`    const ids = dto.${propName} ?? (dto as any).${relation.name}Ids ?? (dto as any).ids;`);
  lines.push(`    if (ids && ids.length > 0) {`);
  lines.push(`      await this.repository.createQueryBuilder().relation("${relation.name}").of(id).add(ids);`);
  lines.push(`    }`);
  lines.push(`    return this.${findMethod}(id, ${tenantArg}user);`);
  lines.push("  }");
  lines.push("");

  // 3. Detach method: removes targetId
  lines.push(
    `  async ${detachMethod}(id: ${idTypeStr}, ${targetParamName}: ${targetIdTypeStr}, ${tenantParam}user?: AuthUser): Promise<void> {`,
  );
  lines.push(`    await this.findOne(id, ${tenantArg}user);`);
  lines.push(`    await this.repository.createQueryBuilder().relation("${relation.name}").of(id).remove(${targetParamName});`);
  lines.push("  }");

  return lines;
}

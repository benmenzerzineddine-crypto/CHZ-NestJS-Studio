import type { CustomEndpointIR, EntityIR, ProjectIR } from "../ir/types";
import type { AccessRule } from "../model/schema";
import pluralize from "pluralize";
import { toKebabCase, toPascalCase } from "../model/naming";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import {
  AUTH_CURRENT_USER_PATH,
  AUTH_PUBLIC_PATH,
  AUTH_ROLES_PATH,
  AUTH_USER_PATH,
  CURRENT_TENANT_PATH,
  entityControllerPath,
  entityDtoPath,
  entityFilePath,
  entityServicePath,
  file,
  renderCacheControl,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";

function accessDecoratorsForRule(rule: AccessRule, ir: ProjectIR): string[] {
  if (!ir.auth.enabled) return [];
  const lines: string[] = [];
  if (rule.level === "public") {
    lines.push("@Public()");
    return lines;
  }

  lines.push("@ApiBearerAuth()");
  if (rule.level === "roles") {
    const roles = (rule.roles ?? []).map((role) => JSON.stringify(role)).join(", ");
    lines.push(`@Roles(${roles})`);
  }
  if (rule.level === "owner") {
    lines.push("// Admin bypass and owner scoping are enforced by the service query.");
  }
  return lines;
}

function accessDecorators(
  entity: EntityIR,
  ir: ProjectIR,
  operation: "list" | "read" | "create" | "update" | "delete",
): string[] {
  return accessDecoratorsForRule(entity.access[operation], ir);
}

function usesPublic(entity: EntityIR, ir: ProjectIR): boolean {
  if (!ir.auth.enabled) return false;
  return (
    Object.values(entity.access).some((rule) => rule.level === "public") ||
    entity.customEndpoints.some((ep) => ep.access.level === "public") ||
    entity.derivedRelations.some(
      (d) =>
        d.kind === "one-to-many" &&
        !d.source.isSystem &&
        (d.source.access.list.level === "public" || d.source.access.create.level === "public"),
    ) ||
    entity.relations.some(
      (r) =>
        r.kind === "many-to-many" &&
        !r.target.isSystem &&
        r.target.access.list.level === "public",
    )
  );
}

function usesRoles(entity: EntityIR, ir: ProjectIR): boolean {
  if (!ir.auth.enabled) return false;
  return (
    Object.values(entity.access).some((rule) => rule.level === "roles") ||
    entity.customEndpoints.some((ep) => ep.access.level === "roles") ||
    entity.derivedRelations.some(
      (d) =>
        d.kind === "one-to-many" &&
        !d.source.isSystem &&
        (d.source.access.list.level === "roles" || d.source.access.create.level === "roles"),
    ) ||
    entity.relations.some(
      (r) =>
        r.kind === "many-to-many" &&
        !r.target.isSystem &&
        r.target.access.list.level === "roles",
    )
  );
}

function protectedOperation(
  entity: EntityIR,
  ir: ProjectIR,
  operation: "list" | "read" | "create" | "update" | "delete",
): boolean {
  return ir.auth.enabled && entity.access[operation].level !== "public";
}

function responseDecorators(
  entity: EntityIR,
  ir: ProjectIR,
  operation: "list" | "read" | "create" | "update" | "delete" | "restore",
): string[] {
  const lines: string[] = [];
  const sourceOperation = operation === "restore" ? "delete" : operation;

  if (operation === "list") {
    lines.push(`@ApiOperation({ summary: "List ${entity.name} records" })`);
    const type = entity.options.pagination ? `Paginated${entity.name}Dto` : `[${entity.name}Entity]`;
    lines.push(`@ApiOkResponse({ description: "Paginated ${entity.name} list", type: ${type} })`);
    lines.push('@ApiBadRequestResponse({ description: "Invalid query parameters" })');
  } else if (operation === "read") {
    lines.push(`@ApiOperation({ summary: "Get one ${entity.name}" })`);
    lines.push(`@ApiOkResponse({ description: "${entity.name} found", type: ${entity.name}Entity })`);
  } else if (operation === "create") {
    lines.push(`@ApiOperation({ summary: "Create a ${entity.name}" })`);
    lines.push(`@ApiCreatedResponse({ description: "${entity.name} created", type: ${entity.name}Entity })`);
    lines.push('@ApiBadRequestResponse({ description: "Validation failed" })');
  } else if (operation === "update") {
    lines.push(`@ApiOperation({ summary: "Update a ${entity.name}" })`);
    lines.push(`@ApiOkResponse({ description: "${entity.name} updated", type: ${entity.name}Entity })`);
    lines.push('@ApiBadRequestResponse({ description: "Validation failed" })');
  } else if (operation === "restore") {
    lines.push(`@ApiOperation({ summary: "Restore a soft-deleted ${entity.name}" })`);
    lines.push(`@ApiNoContentResponse({ description: "${entity.name} restored" })`);
  } else {
    lines.push(`@ApiOperation({ summary: "Delete a ${entity.name}" })`);
    lines.push(`@ApiNoContentResponse({ description: "${entity.name} deleted" })`);
  }

  if (protectedOperation(entity, ir, sourceOperation)) {
    lines.push('@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })');
    if (entity.access[sourceOperation].level !== "authenticated") {
      lines.push('@ApiForbiddenResponse({ description: "Insufficient permissions" })');
    }
  }

  if (operation !== "list" && operation !== "create") {
    lines.push('@ApiNotFoundResponse({ description: "Record not found" })');
  }

  return lines;
}

function customEndpointResponseDecorators(ep: CustomEndpointIR, ir: ProjectIR): string[] {
  const lines: string[] = [];
  lines.push(`@ApiOperation({ summary: ${JSON.stringify(ep.description || `Custom endpoint ${ep.name}`)} })`);
  lines.push('@ApiOkResponse({ description: "Success" })');

  if (ir.auth.enabled && ep.access.level !== "public") {
    lines.push('@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })');
    if (ep.access.level !== "authenticated") {
      lines.push('@ApiForbiddenResponse({ description: "Insufficient permissions" })');
    }
  }

  if (ep.hasIdParam) {
    lines.push('@ApiNotFoundResponse({ description: "Record not found" })');
  }

  return lines;
}

export function emitController(ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityControllerPath(entity);
  const registry = new ImportRegistry();
  registry.add(
    "@nestjs/common",
    "Controller",
    "Get",
    "Post",
    "Patch",
    "Delete",
    "Body",
    "Param",
    "Query",
    "HttpCode",
    entity.primary.type === "int" ? "ParseIntPipe" : "ParseUUIDPipe",
  );
  if (entity.customEndpoints.some((ep) => ep.method === "PUT")) {
    registry.add("@nestjs/common", "Put");
  }
  registry.add(
    "@nestjs/swagger",
    "ApiBadRequestResponse",
    "ApiBearerAuth",
    "ApiCreatedResponse",
    "ApiForbiddenResponse",
    "ApiNoContentResponse",
    "ApiNotFoundResponse",
    "ApiOkResponse",
    "ApiOperation",
    "ApiParam",
    "ApiTags",
    "ApiUnauthorizedResponse",
  );
  registry.add(sourceImport(path, entityServicePath(entity)), `${entity.name}Service`);
  registry.add(sourceImport(path, entityDtoPath(entity, "create")), `Create${entity.name}Dto`);
  registry.add(sourceImport(path, entityDtoPath(entity, "update")), `Update${entity.name}Dto`);
  registry.add(sourceImport(path, entityDtoPath(entity, "query")), `Query${entity.name}Dto`);
  registry.add(sourceImport(path, entityFilePath(entity)), `${entity.name} as ${entity.name}Entity`);
  if (entity.options.pagination) {
    registry.add(
      sourceImport(path, `${entity.moduleDir}/dto/paginated-${entity.dtoPrefix}.dto.ts`),
      `Paginated${entity.name}Dto`,
    );
  }

  const oneToManyDerived = entity.derivedRelations.filter(
    (derived) => derived.kind === "one-to-many" && !derived.source.isSystem,
  );

  for (const derived of oneToManyDerived) {
    const child = derived.source;
    registry.add(sourceImport(path, entityFilePath(child)), `${child.name} as ${child.name}Entity`);
    registry.add(sourceImport(path, entityDtoPath(child, "create")), `Create${child.name}Dto`);
    registry.add(sourceImport(path, entityDtoPath(child, "query")), `Query${child.name}Dto`);
    if (child.options.pagination) {
      registry.add(
        sourceImport(path, `${child.moduleDir}/dto/paginated-${child.dtoPrefix}.dto.ts`),
        `Paginated${child.name}Dto`,
      );
    }
  }

  const manyToManyRelations = entity.relations.filter(
    (relation) => relation.kind === "many-to-many" && !relation.target.isSystem,
  );

  for (const relation of manyToManyRelations) {
    const target = relation.target;
    registry.add(sourceImport(path, entityFilePath(target)), `${target.name} as ${target.name}Entity`);
    registry.add(
      sourceImport(path, `${entity.moduleDir}/dto/attach-${toKebabCase(relation.name)}.dto.ts`),
      `Attach${toPascalCase(relation.name)}Dto`,
    );
    registry.add(
      "@nestjs/common",
      target.primary.type === "int" ? "ParseIntPipe" : "ParseUUIDPipe",
    );
  }
  if (entity.multitenant) {
    registry.add(sourceImport(path, CURRENT_TENANT_PATH), "CurrentTenant");
    if (ir.project.settings.swagger) {
      registry.add("@nestjs/swagger", "ApiHeader");
    }
  }
  registry.add(sourceImport(path, AUTH_CURRENT_USER_PATH), "CurrentUser");
  registry.add(sourceImport(path, AUTH_USER_PATH), "AuthUser");
  if (usesPublic(entity, ir)) registry.add(sourceImport(path, AUTH_PUBLIC_PATH), "Public");
  if (usesRoles(entity, ir)) registry.add(sourceImport(path, AUTH_ROLES_PATH), "Roles");

  const idPipe = entity.primary.type === "int" ? "ParseIntPipe" : "ParseUUIDPipe";
  const idType = entity.primary.tsType;
  const lines: string[] = [];
  lines.push(`@ApiTags('${entity.restPath}')`);
  if (entity.multitenant && ir.project.settings.swagger) {
    lines.push(`@ApiHeader({ name: '${ir.multitenancy.header}', description: 'Tenant identifier', required: true })`);
  }
  if (entity.throttle) {
    registry.add("@nestjs/throttler", "Throttle");
    lines.push(`@Throttle({ default: { limit: ${entity.throttle.limit}, ttl: ${entity.throttle.ttl * 1000} } })`);
  }
  lines.push(`@Controller('${entity.restPath}')`);
  lines.push(`export class ${entity.name}Controller {`);
  lines.push(`  constructor(private readonly service: ${entity.name}Service) {}`);
  lines.push("");

  const tenantParam = entity.multitenant ? "@CurrentTenant() tenantId: string, " : "";
  const tenantArg = entity.multitenant ? "tenantId, " : "";

  lines.push(...responseDecorators(entity, ir, "list").map((line) => `  ${line}`));
  lines.push(...accessDecorators(entity, ir, "list").map((line) => `  ${line}`));
  if (entity.cache) {
    registry.add("@nestjs/common", "Header");
    lines.push(`  @Header('Cache-Control', '${renderCacheControl(entity.cache)}')`);
  }
  lines.push("  @Get()");
  lines.push(`  findAll(@Query() query: Query${entity.name}Dto, ${tenantParam}@CurrentUser() user?: AuthUser) {`);
  lines.push(`    return this.service.findAll(query, ${tenantArg}user);`);
  lines.push("  }");
  lines.push("");

  const idParamDecorator = `  @ApiParam({ name: 'id', ${entity.primary.type === "int" ? "type: Number" : "type: String"}, description: 'Unique ${entity.name} identifier' })`;

  lines.push(...responseDecorators(entity, ir, "read").map((line) => `  ${line}`));
  lines.push(...accessDecorators(entity, ir, "read").map((line) => `  ${line}`));
  lines.push(idParamDecorator);
  if (entity.cache) {
    registry.add("@nestjs/common", "Header");
    lines.push(`  @Header('Cache-Control', '${renderCacheControl(entity.cache)}')`);
  }
  lines.push("  @Get(':id')");
  lines.push(`  findOne(@Param('id', ${idPipe}) id: ${idType}, ${tenantParam}@CurrentUser() user?: AuthUser) {`);
  lines.push(`    return this.service.findOne(id, ${tenantArg}user);`);
  lines.push("  }");
  lines.push("");

  lines.push(...responseDecorators(entity, ir, "create").map((line) => `  ${line}`));
  lines.push(...accessDecorators(entity, ir, "create").map((line) => `  ${line}`));
  lines.push("  @Post()");
  lines.push(`  create(@Body() dto: Create${entity.name}Dto, ${tenantParam}@CurrentUser() user?: AuthUser) {`);
  lines.push(`    return this.service.create(dto, ${tenantArg}user);`);
  lines.push("  }");
  lines.push("");

  lines.push(...responseDecorators(entity, ir, "update").map((line) => `  ${line}`));
  lines.push(...accessDecorators(entity, ir, "update").map((line) => `  ${line}`));
  lines.push(idParamDecorator);
  lines.push("  @Patch(':id')");
  lines.push(
    `  update(@Param('id', ${idPipe}) id: ${idType}, @Body() dto: Update${entity.name}Dto, ${tenantParam}@CurrentUser() user?: AuthUser) {`,
  );
  lines.push(`    return this.service.update(id, dto, ${tenantArg}user);`);
  lines.push("  }");
  lines.push("");

  lines.push(...responseDecorators(entity, ir, "delete").map((line) => `  ${line}`));
  lines.push(...accessDecorators(entity, ir, "delete").map((line) => `  ${line}`));
  lines.push(idParamDecorator);
  lines.push("  @Delete(':id')");
  lines.push("  @HttpCode(204)");
  lines.push(
    `  async remove(@Param('id', ${idPipe}) id: ${idType}, ${tenantParam}@CurrentUser() user?: AuthUser): Promise<void> {`,
  );
  lines.push(`    await this.service.remove(id, ${tenantArg}user);`);
  lines.push("  }");

  if (entity.softDelete) {
    lines.push("");
    lines.push(...responseDecorators(entity, ir, "restore").map((line) => `  ${line}`));
    lines.push(...accessDecorators(entity, ir, "delete").map((line) => `  ${line}`));
    lines.push(idParamDecorator);
    lines.push("  @Post(':id/restore')");
    lines.push("  @HttpCode(204)");
    lines.push(
      `  async restore(@Param('id', ${idPipe}) id: ${idType}, ${tenantParam}@CurrentUser() user?: AuthUser): Promise<void> {`,
    );
    lines.push(`    await this.service.restore(id, ${tenantArg}user);`);
    lines.push("  }");
  }

  for (const derived of oneToManyDerived) {
    const child = derived.source;
    const subPath = toKebabCase(derived.name);
    const findMethod = `find${toPascalCase(derived.name)}`;
    const createMethod = `create${toPascalCase(pluralize.singular(derived.name)) || child.name}`;
    const childListType = child.options.pagination ? `Paginated${child.name}Dto` : `[${child.name}Entity]`;

    lines.push("");
    lines.push(`  @ApiOperation({ summary: "List ${derived.name} for ${entity.name}" })`);
    lines.push(`  @ApiOkResponse({ description: "${derived.name} list for ${entity.name}", type: ${childListType} })`);
    lines.push(`  @ApiNotFoundResponse({ description: "${entity.name} not found" })`);
    lines.push(...accessDecoratorsForRule(child.access.list, ir).map((line) => `  ${line}`));
    lines.push(idParamDecorator);
    lines.push(`  @Get(':id/${subPath}')`);
    lines.push(
      `  ${findMethod}(@Param('id', ${idPipe}) id: ${idType}, @Query() query: Query${child.name}Dto, ${tenantParam}@CurrentUser() user?: AuthUser) {`,
    );
    lines.push(`    return this.service.${findMethod}(id, query, ${tenantArg}user);`);
    lines.push("  }");

    lines.push("");
    lines.push(`  @ApiOperation({ summary: "Create ${child.name} for ${entity.name}" })`);
    lines.push(`  @ApiCreatedResponse({ description: "${child.name} created for ${entity.name}", type: ${child.name}Entity })`);
    lines.push(`  @ApiNotFoundResponse({ description: "${entity.name} not found" })`);
    lines.push(`  @ApiBadRequestResponse({ description: "Validation failed" })`);
    lines.push(...accessDecoratorsForRule(child.access.create, ir).map((line) => `  ${line}`));
    lines.push(idParamDecorator);
    lines.push(`  @Post(':id/${subPath}')`);
    lines.push(
      `  ${createMethod}(@Param('id', ${idPipe}) id: ${idType}, @Body() dto: Create${child.name}Dto, ${tenantParam}@CurrentUser() user?: AuthUser) {`,
    );
    lines.push(`    return this.service.${createMethod}(id, dto, ${tenantArg}user);`);
    lines.push("  }");
  }

  for (const relation of manyToManyRelations) {
    const target = relation.target;
    const subPath = toKebabCase(relation.name);
    const findMethod = `find${toPascalCase(relation.name)}`;
    const attachMethod = `attach${toPascalCase(relation.name)}`;
    const singleName = pluralize.singular(relation.name);
    const detachMethod = `detach${toPascalCase(singleName)}`;
    const targetParamName = `${singleName}Id`;
    const targetPipe = target.primary.type === "int" ? "ParseIntPipe" : "ParseUUIDPipe";
    const targetIdType = target.primary.tsType;
    const targetIdParamDecorator = `  @ApiParam({ name: '${targetParamName}', ${target.primary.type === "int" ? "type: Number" : "type: String"}, description: 'Unique ${target.name} identifier' })`;

    lines.push("");
    lines.push(`  @ApiOperation({ summary: "List ${relation.name} for ${entity.name}" })`);
    lines.push(`  @ApiOkResponse({ description: "${relation.name} list for ${entity.name}", type: [${target.name}Entity] })`);
    lines.push(`  @ApiNotFoundResponse({ description: "${entity.name} not found" })`);
    lines.push(...accessDecoratorsForRule(target.access.list, ir).map((line) => `  ${line}`));
    lines.push(idParamDecorator);
    lines.push(`  @Get(':id/${subPath}')`);
    lines.push(
      `  ${findMethod}(@Param('id', ${idPipe}) id: ${idType}, ${tenantParam}@CurrentUser() user?: AuthUser) {`,
    );
    lines.push(`    return this.service.${findMethod}(id, ${tenantArg}user);`);
    lines.push("  }");

    lines.push("");
    lines.push(`  @ApiOperation({ summary: "Attach ${relation.name} to ${entity.name}" })`);
    lines.push(`  @ApiCreatedResponse({ description: "${relation.name} attached to ${entity.name}", type: [${target.name}Entity] })`);
    lines.push(`  @ApiNotFoundResponse({ description: "${entity.name} not found" })`);
    lines.push(`  @ApiBadRequestResponse({ description: "Validation failed" })`);
    lines.push(...accessDecoratorsForRule(entity.access.update, ir).map((line) => `  ${line}`));
    lines.push(idParamDecorator);
    lines.push(`  @Post(':id/${subPath}')`);
    lines.push(
      `  ${attachMethod}(@Param('id', ${idPipe}) id: ${idType}, @Body() dto: Attach${toPascalCase(relation.name)}Dto, ${tenantParam}@CurrentUser() user?: AuthUser) {`,
    );
    lines.push(`    return this.service.${attachMethod}(id, dto, ${tenantArg}user);`);
    lines.push("  }");

    lines.push("");
    lines.push(`  @ApiOperation({ summary: "Detach ${target.name} from ${entity.name}" })`);
    lines.push(`  @ApiNoContentResponse({ description: "${target.name} detached from ${entity.name}" })`);
    lines.push(`  @ApiNotFoundResponse({ description: "${entity.name} not found" })`);
    lines.push(...accessDecoratorsForRule(entity.access.update, ir).map((line) => `  ${line}`));
    lines.push(idParamDecorator);
    lines.push(targetIdParamDecorator);
    lines.push(`  @Delete(':id/${subPath}/:${targetParamName}')`);
    lines.push("  @HttpCode(204)");
    lines.push(
      `  async ${detachMethod}(@Param('id', ${idPipe}) id: ${idType}, @Param('${targetParamName}', ${targetPipe}) ${targetParamName}: ${targetIdType}, ${tenantParam}@CurrentUser() user?: AuthUser): Promise<void> {`,
    );
    lines.push(`    await this.service.${detachMethod}(id, ${targetParamName}, ${tenantArg}user);`);
    lines.push("  }");
  }

  for (const ep of entity.customEndpoints) {
    lines.push("");
    lines.push(...customEndpointResponseDecorators(ep, ir).map((line) => `  ${line}`));
    lines.push(...accessDecoratorsForRule(ep.access, ir).map((line) => `  ${line}`));
    const pathParams = Array.from(ep.path.matchAll(/:([a-zA-Z0-9_]+)/g)).map((m) => m[1]);
    for (const param of pathParams) {
      lines.push(`  @ApiParam({ name: '${param}', required: true, description: '${param} path parameter' })`);
    }
    if (ep.skipThrottle) {
      registry.add("@nestjs/throttler", "SkipThrottle");
      lines.push("  @SkipThrottle()");
    } else if (ep.throttle) {
      registry.add("@nestjs/throttler", "Throttle");
      lines.push(`  @Throttle({ default: { limit: ${ep.throttle.limit}, ttl: ${ep.throttle.ttl * 1000} } })`);
    }
    if (ep.cache && ep.method === "GET") {
      registry.add("@nestjs/common", "Header");
      lines.push(`  @Header('Cache-Control', '${renderCacheControl(ep.cache)}')`);
    }
    const methodDecorator = ep.method.charAt(0) + ep.method.slice(1).toLowerCase();
    const routeArg = ep.routePath ? `'${ep.routePath}'` : "";
    lines.push(`  @${methodDecorator}(${routeArg})`);
    if (ep.hasIdParam) {
      lines.push(
        `  ${ep.name}(@Param('id', ${idPipe}) id: ${idType}, ${tenantParam}@CurrentUser() user?: AuthUser) {`,
      );
      lines.push(`    return this.service.${ep.name}(id, ${tenantArg}user);`);
      lines.push("  }");
    } else {
      lines.push(`  ${ep.name}(${tenantParam}@CurrentUser() user?: AuthUser) {`);
      lines.push(`    return this.service.${ep.name}(${tenantArg}user);`);
      lines.push("  }");
    }
  }

  lines.push("}");
  const content = `${registry.render()}${lines.join("\n")}\n`;
  return file(path, content);
}

export function emitControllers(ir: ProjectIR): GeneratedFile[] {
  return ir.entities
    .filter((entity) => !entity.isSystem)
    .map((entity) => emitController(ir, entity));
}

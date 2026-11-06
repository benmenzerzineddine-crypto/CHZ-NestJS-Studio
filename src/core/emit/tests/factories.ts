import type { EntityIR, GeneratedFile, ProjectIR } from "../../ir/types";
import { entityFilePath, file } from "../helpers";
import { buildableEntities, entityPath, isRequiredRelation, lowerFirst } from "./common";

function numericValue(field: EntityIR["fields"][number], integer: boolean): string {
  const min = field.definition.validators?.min;
  const max = field.definition.validators?.max;
  let value = integer ? Math.ceil(min ?? 1) : (min ?? 1.5);
  if (max !== undefined && value > max) value = integer ? Math.floor(max) : max;
  return String(value);
}

function stringValue(
  entity: EntityIR,
  field: EntityIR["fields"][number],
  unique: boolean,
): string {
  const minLength = field.definition.validators?.minLength ?? 0;
  const columnLength =
    field.type === "string" ? field.definition.column?.length ?? 255 : 255;
  const maxLength = Math.min(
    field.definition.validators?.maxLength ?? columnLength,
    columnLength,
  );
  const base = unique
    ? "`${" + JSON.stringify(entity.singularKebab) + "}-${suffix}`"
    : "`${" + JSON.stringify(entity.name) + "} ${suffix}`";
  return `sampleString(${base}, ${minLength}, ${maxLength})`;
}

function fieldValue(entity: EntityIR, fieldName: string): string | undefined {
  const field = entity.fields.find((candidate) => candidate.name === fieldName);
  if (!field) return undefined;

  if (field.name === "email") return "`${suffix}@example.com`";
  if (field.type === "enum") {
    const value = field.enum?.values[0] ?? "";
    return JSON.stringify(value);
  }
  if (field.type === "text") return stringValue(entity, field, false);
  if (field.type === "string") return stringValue(entity, field, field.unique);
  if (field.type === "int") return numericValue(field, true);
  if (field.type === "float") return numericValue(field, false);
  if (field.type === "decimal") return '"1.00"';
  if (field.type === "boolean") return "true";
  if (field.type === "date") return '"2024-01-01"';
  if (field.type === "datetime") return '"2024-01-01T00:00:00.000Z"';
  if (field.type === "uuid") return "randomUUID()";
  if (field.type === "json") return "{}";
  return stringValue(entity, field, false);
}

export function factoryBuild(ir: ProjectIR, entity: EntityIR): string {
  const lines: string[] = [];
  const dependencies = entity.relations.filter(isRequiredRelation);
  const user = ir.user;
  if (!user) throw new Error("The project has no built-in User entity.");

  lines.push(`  async function build${entity.name}(suffix: string): Promise<Record<string, unknown>> {`);
  for (const relation of dependencies) {
    const variable = `${lowerFirst(relation.target.name)}${relation.name.charAt(0).toUpperCase()}${relation.name.slice(1)}`;
    lines.push(`    const ${variable} = await make${relation.target.name}(`);
    lines.push(`      \`\${suffix}-${relation.name}\`,`);
    lines.push("    );");
  }

  lines.push("    const payload: Record<string, unknown> = {");
  for (const field of entity.fields) {
    if (field.primary || field.generated) continue;
    if (!field.required || field.defaultValue !== undefined) continue;
    const value = fieldValue(entity, field.name);
    if (value === undefined) continue;
    lines.push(`      ${field.name}: ${value},`);
  }
  for (const relation of entity.relations) {
    if (relation.kind !== "many-to-one" && relation.kind !== "one-to-one") continue;
    if (relation.owner || relation.nullable) continue;
    if (!relation.fkName) continue;
    if (relation.target.isSystem) {
      lines.push(`      ${relation.fkName}: ctx.ownerId,`);
    } else {
      lines.push(
        `      ${relation.fkName}: ${lowerFirst(relation.target.name)}${relation.name.charAt(0).toUpperCase()}${relation.name.slice(1)}.${relation.target.primary.name},`,
      );
    }
  }
  lines.push("    };");
  lines.push("    return payload;");
  lines.push("  }");
  lines.push("");
  lines.push(
    `  async function make${entity.name}(suffix: string, token: string | null = ctx.tokens.creator): Promise<${entity.name}> {`,
  );
  lines.push(`    const payload = await build${entity.name}(suffix);`);
  lines.push("");
  lines.push("    const response = await request(ctx.app.getHttpServer())");
  lines.push(`      .post("${entityPath(ir, entity)}")`);
  lines.push("      .set(authHeader(token))");
  lines.push("      .send(payload);");
  lines.push("    if (response.status !== 201) {");
  lines.push(
    `      throw new Error(\`Failed to create ${entity.name}: \${response.status} \${JSON.stringify(response.body)}\`);`,
  );
  lines.push("    }");
  lines.push("");
  lines.push(`    const row = response.body as ${entity.name};`);
  if (entity.ownerColumn) {
    lines.push(
      `    await ctx.dataSource.getRepository(${entity.name}).update(row.${entity.primary.name}, { ${entity.ownerColumn}: ctx.ownerId });`,
    );
  }
  lines.push("    return row;");
  lines.push("  }");
  return lines.join("\n");
}

export function emitFactories(ir: ProjectIR): GeneratedFile {
  const buildable = buildableEntities(ir);
  const entities = ir.entities.filter(
    (entity) => !entity.isSystem && buildable.has(entity.id),
  );
  const lines: string[] = [];
  lines.push('import { INestApplication } from "@nestjs/common";');
  lines.push('import { randomUUID } from "node:crypto";');
  lines.push('import request from "supertest";');
  lines.push('import { DataSource } from "typeorm";');
  lines.push('import { authHeader } from "./auth";');
  for (const entity of entities) {
    lines.push(`import { ${entity.name} } from "../../${entityFilePath(entity).replace(/\.ts$/, "")}";`);
  }
  lines.push("");
  lines.push("export interface FactoryContext {");
  lines.push("  app: INestApplication;");
  lines.push("  dataSource: DataSource;");
  lines.push("  tokens: { admin: string; owner: string; other: string; creator: string };");
  lines.push("  ownerId: string;");
  lines.push("}");
  lines.push("");
  lines.push("export function createFactories(ctx: FactoryContext) {");
  lines.push("  function sampleString(value: string, minLength: number, maxLength: number): string {");
  lines.push('    const padded = value + "x".repeat(Math.max(0, minLength - value.length));');
  lines.push("    return padded.slice(0, Math.max(minLength, maxLength));");
  lines.push("  }");
  lines.push("");
  for (const entity of entities) {
    lines.push(factoryBuild(ir, entity));
    lines.push("");
  }
  lines.push("  return {");
  for (const entity of entities) {
    lines.push(`    make${entity.name},`);
    lines.push(`    build${entity.name},`);
  }
  lines.push("  };");
  lines.push("}");
  lines.push("");
  return file("test/utils/factories.ts", lines.join("\n"), "typescript");
}

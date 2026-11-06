import type { EntityIR, FieldIR, ProjectIR, RelationIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { toSnakeCase } from "../model/naming";
import { file, sourceImport } from "./helpers";
import {
  DATA_SOURCE_PATH,
  ENUMS_PATH,
  SEED_PATH,
  USER_ENTITY_PATH,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";

const SAMPLE_ROWS = 3;

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function sampleId(entity: EntityIR, entityIndex: number, row: number): string {
  const value = 1000 + entityIndex * 10 + row + 1;
  if (entity.primary.type === "int") return String(value);
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

function sampleString(
  field: FieldIR,
  entity: EntityIR,
  row: number,
): string {
  const maxLength = Math.min(
    field.definition.validators?.maxLength ??
      field.definition.column?.length ??
      255,
    field.definition.column?.length ?? 255,
  );
  const minLength = field.definition.validators?.minLength ?? 0;
  const base =
    field.name === "email"
      ? `seed+${entity.singularKebab}-${row + 1}@example.com`
      : field.unique
        ? `${entity.name} ${row + 1}`
        : `${entity.name} sample ${row + 1}`;
  const padded = base.padEnd(minLength, "x");
  return padded.slice(0, Math.max(minLength, maxLength));
}

function numericValue(field: FieldIR, row: number): number {
  const min = field.definition.validators?.min ?? 0;
  const max = field.definition.validators?.max;
  const step = field.type === "int" ? 1 : 1.5;
  let value = min + row * step;
  if (field.type === "int") value = Math.ceil(value);
  if (max !== undefined && value > max) value = max;
  return value;
}

function fieldValue(
  field: FieldIR,
  entity: EntityIR,
  entityIndex: number,
  row: number,
  registry: ImportRegistry,
): string {
  if (field.enum) {
    const enumDef = field.enum;
    registry.add(sourceImport(SEED_PATH, ENUMS_PATH), enumDef.name);
    const member = enumDef.members[row % enumDef.members.length];
    return `${enumDef.name}.${member}`;
  }

  switch (field.type) {
    case "string":
      return JSON.stringify(sampleString(field, entity, row));
    case "text":
      return JSON.stringify(sampleString(field, entity, row));
    case "int":
      return String(numericValue(field, row));
    case "float":
      return String(numericValue(field, row));
    case "decimal": {
      const scale = field.definition.column?.scale ?? 2;
      return JSON.stringify(numericValue(field, row).toFixed(scale));
    }
    case "boolean":
      return row % 2 === 0 ? "true" : "false";
    case "date":
      return JSON.stringify(`2024-01-0${row + 1}`);
    case "datetime":
      return `new Date(${JSON.stringify(`2024-01-0${row + 1}T00:00:00.000Z`)})`;
    case "uuid":
      return JSON.stringify(sampleId(entity, entityIndex, row));
    case "json":
      return JSON.stringify({ seed: row + 1 });
    default:
      return JSON.stringify("sample");
  }
}

function requiredDependencies(entity: EntityIR): RelationIR[] {
  return entity.relations.filter(
    (relation) =>
      !relation.owner &&
      relation.fkName !== undefined &&
      !relation.nullable &&
      !relation.target.isSystem,
  );
}

function orderEntities(entities: EntityIR[]): EntityIR[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const state = new Map<string, "visiting" | "done">();
  const ordered: EntityIR[] = [];

  function visit(entity: EntityIR): void {
    if (state.get(entity.id) === "done") return;
    if (state.get(entity.id) === "visiting") {
      throw new Error(
        `Seed cannot order cyclic required relations involving ${entity.name}. Make one side nullable.`,
      );
    }
    state.set(entity.id, "visiting");
    for (const dependency of requiredDependencies(entity)) {
      const target = byId.get(dependency.target.id);
      if (target) visit(target);
    }
    state.set(entity.id, "done");
    ordered.push(entity);
  }

  for (const entity of entities) visit(entity);
  return ordered;
}

function rowLines(
  entity: EntityIR,
  entityIndex: number,
  orderIndex: Map<string, number>,
  registry: ImportRegistry,
): string[] {
  const lines: string[] = [];
  const primary = entity.primary.name;
  const variable = `${lowerFirst(entity.name)}Rows`;

  lines.push(`  const ${variable}: Array<Record<string, unknown>> = [`);
  for (let row = 0; row < SAMPLE_ROWS; row += 1) {
    lines.push("    {");
    lines.push(`      ${primary}: ${JSON.stringify(sampleId(entity, entityIndex, row))},`);
    for (const field of entity.fields) {
      if (field.primary) continue;
      lines.push(
        `      ${field.name}: ${fieldValue(field, entity, entityIndex, row, registry)},`,
      );
    }
    for (const relation of entity.relations) {
      if (relation.owner || !relation.fkName) continue;
      if (relation.target.isSystem) {
        lines.push(`      ${relation.fkName}: adminId,`);
        continue;
      }
      const targetIndex = orderIndex.get(relation.target.id);
      if (targetIndex === undefined || targetIndex >= entityIndex) continue;
      lines.push(
        `      ${relation.fkName}: ${JSON.stringify(sampleId(relation.target, targetIndex, row % SAMPLE_ROWS))},`,
      );
    }
    lines.push("    },");
  }
  lines.push("  ];");
  lines.push(
    `  await dataSource.getRepository(${entity.name}).upsert(${variable} as QueryDeepPartialEntity<${entity.name}>[], ["${primary}"]);`,
  );
  return lines;
}

function manyToManyLines(
  entities: EntityIR[],
  orderIndex: Map<string, number>,
): string[] {
  const lines: string[] = [];
  for (const entity of entities) {
    const sourceIndex = orderIndex.get(entity.id);
    if (sourceIndex === undefined) continue;
    for (const relation of entity.relations) {
      if (relation.kind !== "many-to-many" || relation.target.isSystem) continue;
      const targetIndex = orderIndex.get(relation.target.id);
      if (targetIndex === undefined) continue;
      if (!relation.joinTableName || !relation.joinColumnName || !relation.inverseJoinColumnName) {
        continue;
      }

      const sourceColumn = toSnakeCase(relation.joinColumnName);
      const targetColumn = toSnakeCase(relation.inverseJoinColumnName);
      lines.push(`  await dataSource`);
      lines.push("    .createQueryBuilder()");
      lines.push("    .insert()");
      lines.push(`    .into(${JSON.stringify(relation.joinTableName)})`);
      lines.push("    .values([");
      for (let row = 0; row < SAMPLE_ROWS; row += 1) {
        lines.push(
          `      { ${sourceColumn}: ${JSON.stringify(sampleId(entity, sourceIndex, row))}, ${targetColumn}: ${JSON.stringify(sampleId(relation.target, targetIndex, row))} },`,
        );
      }
      lines.push("    ])");
      lines.push("    .orIgnore()");
      lines.push("    .execute();");
    }
  }
  return lines;
}

export function emitSeed(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.addSideEffect("reflect-metadata");
  registry.addSideEffect("dotenv/config");
  registry.add("bcrypt", "hash");
  registry.add("typeorm", "DataSource");
  registry.addType("typeorm", "QueryDeepPartialEntity");
  registry.addDefault(sourceImport(SEED_PATH, DATA_SOURCE_PATH), "baseDataSource");
  registry.add(sourceImport(SEED_PATH, USER_ENTITY_PATH), "User");

  const entities = ir.entities.filter((entity) => !entity.isSystem);
  for (const entity of entities) {
    registry.add(sourceImport(SEED_PATH, `${entity.moduleDir}/${entity.singularKebab}.entity.ts`), entity.name);
  }

  let ordered: EntityIR[] = entities;
  let orderError: string | null = null;
  try {
    ordered = orderEntities(entities);
  } catch (error) {
    orderError = error instanceof Error ? error.message : String(error);
  }
  const orderIndex = new Map(ordered.map((entity, index) => [entity.id, index]));

  const requiredSystemRelation = entities.some((entity) =>
    entity.relations.some(
      (relation) =>
        relation.fkName !== undefined &&
        !relation.owner &&
        !relation.nullable &&
        relation.target.isSystem,
    ),
  );

  const lines: string[] = [];
  lines.push(`const ADMIN_ROLE = ${JSON.stringify(ir.auth.adminRole)};`);
  lines.push(
    `const SEED_ADMIN = ${ir.auth.seedAdmin ? "true" : "false"} && process.env.SEED_ADMIN !== "false";`,
  );
  lines.push(`const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";`);
  lines.push(
    `const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me-admin-password";`,
  );
  lines.push("const RESET = process.argv.includes(\"--reset\");");
  lines.push("");
  lines.push("async function seed(): Promise<void> {");
  if (orderError) {
    lines.push(`  throw new Error(${JSON.stringify(orderError)});`);
  }
  lines.push("  if (RESET && process.env.NODE_ENV === \"production\") {");
  lines.push("    throw new Error(\"--reset is not allowed in production.\");");
  lines.push("  }");
  lines.push("");
  lines.push(
    "  const synchronize =",
  );
  lines.push(
    '    process.env.DB_SYNCHRONIZE === "true" ||',
  );
  lines.push(
    '    (process.env.DB_SYNCHRONIZE !== "false" && process.env.NODE_ENV !== "production");',
  );
  lines.push(
    "  const dataSource = new DataSource({ ...baseDataSource.options, synchronize });",
  );
  lines.push("  await dataSource.initialize();");
  lines.push("");
  lines.push("  try {");
  lines.push("    if (RESET) {");
  if (entities.length === 0) {
    lines.push("      console.log(\"No entity tables to reset.\");");
  } else {
    lines.push("      const tables = [");
    for (const entity of entities) {
      for (const relation of entity.relations) {
        if (relation.kind === "many-to-many" && relation.joinTableName) {
          lines.push(`        ${JSON.stringify(relation.joinTableName)},`);
        }
      }
    }
    for (const entity of [...ordered].reverse()) {
      lines.push(`        ${JSON.stringify(entity.tableName)},`);
    }
    lines.push("      ];");
    lines.push("      for (const table of tables) {");
    lines.push("        await dataSource.createQueryBuilder().delete().from(table).execute();");
    lines.push("      }");
    lines.push("      console.log(`Reset ${tables.length} tables.`);");
  }
  lines.push("    }");
  lines.push("");
  lines.push("    const users = dataSource.getRepository(User);");
  lines.push("    if (SEED_ADMIN) {");
  lines.push("      const existing = await users.findOne({ where: { email: ADMIN_EMAIL } });");
  lines.push("      if (!existing) {");
  lines.push("        await users.save(users.create({");
  lines.push("          email: ADMIN_EMAIL,");
  lines.push("          passwordHash: await hash(ADMIN_PASSWORD, 12),");
  lines.push("          roles: [ADMIN_ROLE],");
  lines.push("          isActive: true,");
  lines.push("        }));");
  lines.push("        console.log(`Created admin ${ADMIN_EMAIL}.`);");
  lines.push("      } else {");
  lines.push("        console.log(`Admin ${ADMIN_EMAIL} already exists.`);");
  lines.push("      }");
  lines.push("    }");
  lines.push("");
  lines.push("    const admin = await users.findOne({ where: { email: ADMIN_EMAIL } });");
  lines.push("    const adminId = admin?.id;");
  if (requiredSystemRelation) {
    lines.push("    if (!adminId) {");
    lines.push(
      "      throw new Error(\"Seed data needs the admin user. Set SEED_ADMIN=true or create ADMIN_EMAIL first.\");",
    );
    lines.push("    }");
  }
  lines.push("");

  for (const entity of ordered) {
    const index = orderIndex.get(entity.id) ?? 0;
    lines.push(...rowLines(entity, index, orderIndex, registry));
    lines.push("");
  }

  lines.push(...manyToManyLines(ordered, orderIndex));
  if (entities.length > 0) lines.push("");
  lines.push(`    console.log("Seed complete.");`);
  lines.push("  } finally {");
  lines.push("    await dataSource.destroy();");
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push("seed().catch((error: unknown) => {");
  lines.push("  console.error(error);");
  lines.push("  process.exitCode = 1;");
  lines.push("});");

  const content = `${registry.render()}${lines.join("\n")}\n`;
  return file(SEED_PATH, content);
}

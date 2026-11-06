import type { Driver, Project } from "../model/schema";
import { parseOpenApi } from "./openapi";
import { parseSqlDdl } from "./sql-ddl";
import { parseTypeOrmSource } from "./typeorm-ast";

export type ImportFormat = "sql" | "typeorm" | "openapi";

export interface ImportOptions {
  format?: ImportFormat;
  content: string;
  projectName?: string;
  driver?: Driver;
  defaultAuth?: boolean;
}

/**
 * Automatically inspects input text to infer if it is SQL DDL, TypeORM code, or OpenAPI JSON.
 */
export function detectFormat(content: string): ImportFormat {
  const trimmed = content.trim();

  // Check OpenAPI JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.openapi || parsed.swagger || parsed.components?.schemas || parsed.definitions) {
        return "openapi";
      }
    } catch {
      // not JSON
    }
  }

  // Check TypeORM decorators
  if (
    /@Entity\b/.test(trimmed) ||
    /@Column\b/.test(trimmed) ||
    /@PrimaryGeneratedColumn\b/.test(trimmed) ||
    /@ManyToOne\b/.test(trimmed)
  ) {
    return "typeorm";
  }

  // Default to SQL DDL
  return "sql";
}

/**
 * Unified schema importer returning a valid Project model.
 */
export function importProject(options: ImportOptions): Project {
  const format = options.format || detectFormat(options.content);

  switch (format) {
    case "sql":
      return parseSqlDdl(options.content, {
        projectName: options.projectName,
        driver: options.driver,
        defaultAuth: options.defaultAuth,
      });

    case "typeorm":
      return parseTypeOrmSource(options.content, {
        projectName: options.projectName,
        driver: options.driver,
        defaultAuth: options.defaultAuth,
      });

    case "openapi":
      return parseOpenApi(options.content, {
        projectName: options.projectName,
        driver: options.driver,
        defaultAuth: options.defaultAuth,
      });

    default:
      throw new Error(`Unsupported schema format: ${format as string}`);
  }
}

export * from "./naming";
export * from "./sql-ddl";
export * from "./typeorm-ast";
export * from "./openapi";

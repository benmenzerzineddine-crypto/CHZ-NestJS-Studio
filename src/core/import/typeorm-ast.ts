import type { Project } from "../model/schema";
import type { TypeOrmImportOptions } from "./typeorm/types";
import { extractEnums } from "./typeorm/infer";
import { parseEntityClasses } from "./typeorm/parser";
import { buildTypeOrmProject } from "./typeorm/project-builder";

export * from "./typeorm/types";
export * from "./typeorm/infer";
export * from "./typeorm/parser";
export * from "./typeorm/project-builder";

export function parseTypeOrmSource(source: string, options: TypeOrmImportOptions = {}): Project {
  const enums = extractEnums(source);
  const entities = parseEntityClasses(source);
  return buildTypeOrmProject(entities, enums, options);
}

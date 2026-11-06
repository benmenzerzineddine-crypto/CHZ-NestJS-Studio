import type { Project } from "./model/schema";
import { validateProject, type ValidationIssue } from "./validate/validate";
import { buildFileTree } from "./ir/tree";
import { buildIR, IrBuildError } from "./ir/build";
import type { FileKind, GeneratedFile, ProjectIR } from "./ir/types";
import { formatFiles } from "./format/format";
import { emitScaffold } from "./emit/scaffold";
import { emitEnums } from "./emit/enums";
import { emitCommon } from "./emit/common";
import {
  emitAppModule,
  emitDataSource,
  emitMain,
  emitSwaggerConfig,
  emitTypeOrmConfig,
} from "./emit/config";
import { emitAuthBasics } from "./emit/auth-basics";
import { emitAuth } from "./emit/auth";
import { emitUsers } from "./emit/users";
import { emitTests } from "./emit/tests";
import { emitMail } from "./emit/mail";
import { emitAttachments } from "./emit/attachments";
import { emitHealth } from "./emit/health";
import { emitEntity } from "./emit/entity";
import { emitEntityDtos } from "./emit/dto";
import { emitService } from "./emit/service";
import { emitController } from "./emit/controller";
import { emitModule } from "./emit/module";
import { emitReadme } from "./emit/readme";
import { stableStringify } from "./export/manifest";
import { emitDocker } from "./emit/docker";
import { emitSeed } from "./emit/seed";
import { emitCreateInput, emitResolver, emitUpdateInput } from "./emit/graphql";
import { emitJobs } from "./emit/jobs";
import { emitWebSockets } from "./emit/websockets";

const KINDS: FileKind[] = ["typescript", "json", "config", "markdown", "env", "docker"];

export interface GenerateStats {
  fileCount: number;
  totalBytes: number;
  byKind: Record<FileKind, number>;
}

export interface GenerateResult {
  files: GeneratedFile[];
  tree: ReturnType<typeof buildFileTree>;
  issues: ValidationIssue[];
  stats: GenerateStats;
  warnings: string[];
}

function emptyStats(): GenerateStats {
  return {
    fileCount: 0,
    totalBytes: 0,
    byKind: Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<FileKind, number>,
  };
}

function statsFor(files: GeneratedFile[]): GenerateStats {
  const byKind = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<FileKind, number>;
  for (const generated of files) byKind[generated.kind] += 1;
  return {
    fileCount: files.length,
    totalBytes: new TextEncoder().encode(files.map((generated) => generated.content).join("")).length,
    byKind,
  };
}

function collect(ir: ProjectIR): GeneratedFile[] {
  const files: GeneratedFile[] = [
    ...emitScaffold(ir),
    emitEnums(ir),
    ...emitCommon(ir),
    emitTypeOrmConfig(ir),
    emitDataSource(ir),
    emitSwaggerConfig(ir),
    emitMain(ir),
    emitAppModule(ir),
    emitHealth(ir),
    ...emitAuthBasics(ir),
    ...emitAuth(ir),
    ...emitUsers(ir),
    ...emitMail(ir),
    ...emitAttachments(ir),
    ...emitJobs(ir),
    ...emitWebSockets(ir),
    ...(ir.project.settings.tests ||
    ir.auth.seedAdmin ||
    ir.entities.some((entity) => !entity.isSystem)
      ? [emitSeed(ir)]
      : []),
    ...emitTests(ir),
    ...emitDocker(ir),
    emitReadme(ir),
  ];

  for (const entity of ir.entities.filter((candidate) => !candidate.isSystem)) {
    files.push(
      { ...emitEntity(ir, entity), kind: "typescript" },
      ...emitEntityDtos(ir, entity),
      emitService(ir, entity),
      emitController(ir, entity),
      emitModule(ir, entity),
    );
    if (ir.graphql.enabled) {
      files.push(
        emitCreateInput(ir, entity),
        emitUpdateInput(ir, entity),
        emitResolver(ir, entity),
      );
    }
  }

  const seen = new Set<string>();
  for (const generated of files) {
    if (seen.has(generated.path)) {
      throw new Error(`Two emitters produced ${generated.path}.`);
    }
    seen.add(generated.path);
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Repeat previews and exports of the same model reuse the completed IR, files
 * and formatting. Keys are stable-stringified projects, so unrelated edits do
 * not collide.
 */
const generationCache = new Map<string, Promise<GenerateResult>>();

export interface GenerateOptions {
  /** Skip Prettier for a fast preview pass. Defaults to true. */
  format?: boolean;
}

export function generateProject(
  project: Project,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const key = `${options.format === false ? "raw" : "formatted"}:${stableStringify(project)}`;
  const cached = generationCache.get(key);
  if (cached) return cached;

  const pending = generateUncached(project, options);
  generationCache.set(key, pending);
  void pending.catch(() => generationCache.delete(key));
  for (const oldest of generationCache.keys()) {
    if (generationCache.size <= 12) break;
    generationCache.delete(oldest);
  }
  return pending;
}

async function generateUncached(
  project: Project,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const issues = validateProject(project);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return {
      files: [],
      tree: buildFileTree([]),
      issues,
      stats: emptyStats(),
      warnings: [],
    };
  }

  let ir: ProjectIR;
  try {
    ir = buildIR(project);
  } catch (error) {
    const message = error instanceof IrBuildError ? error.message : error instanceof Error ? error.message : String(error);
    return {
      files: [],
      tree: buildFileTree([]),
      issues: [
        ...issues,
        {
          code: "generator.build",
          severity: "error",
          message: `Could not build the generator model: ${message}`,
        },
      ],
      stats: emptyStats(),
      warnings: [],
    };
  }

  let raw: GeneratedFile[];
  try {
    raw = collect(ir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      files: [],
      tree: buildFileTree([]),
      issues: [
        ...issues,
        {
          code: "generator.emit",
          severity: "error",
          message: `Could not emit the project: ${message}`,
        },
      ],
      stats: emptyStats(),
      warnings: [],
    };
  }

  const formatted =
    options.format === false
      ? { files: raw, warnings: [] }
      : await formatFiles(raw);
  const files = formatted.files.sort((a, b) => a.path.localeCompare(b.path));
  const tree = buildFileTree(files, project.packageName);

  return {
    files,
    tree,
    issues,
    stats: statsFor(files),
    warnings: formatted.warnings,
  };
}

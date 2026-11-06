/**
 * Node runner for the standalone CLI. All decision logic lives in
 * `src/core/cli/`; this file only reads and writes the filesystem.
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ZodError } from "zod";
import {
  CliUsageError,
  EXIT_INVALID_MODEL,
  EXIT_OK,
  EXIT_USAGE,
  EXIT_WRITE_FAILED,
  USAGE,
  parseCliArgs,
  type CliCommand,
  type GenerateCommand,
  type ValidateCommand,
  type ImportCommand,
} from "../core/cli/args";
import { importProject } from "../core/import";
import { conflictActions, conflictLine, issueLine, planReport } from "../core/cli/actions";
import { assertSafeRelativePath } from "../core/cli/paths";
import {
  buildExportPlan,
  manifestOverrides,
  resolveExportWrites,
  type DiskFileState,
  type ExportWrite,
} from "../core/export/plan";
import {
  createManifest,
  parseProjectManifest,
  sha256,
  type ProjectManifest,
} from "../core/export/manifest";
import { generateProject } from "../core/generate";
import { migrateProject, type Project } from "../core/model/schema";
import { validateProject, type ValidationIssue } from "../core/validate/validate";
import { GENERATOR_VERSION } from "../core/version";

const MANIFEST_FILE = "chz-nest.json";

export interface CliIO {
  out: (text: string) => void;
  err: (text: string) => void;
}

export const processIo: CliIO = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
};

class CliFailure extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "CliFailure";
    this.exitCode = exitCode;
  }
}

async function readJson(file: string): Promise<unknown> {
  const absolute = path.resolve(file);
  let text: string;
  try {
    text = await readFile(absolute, "utf8");
  } catch {
    throw new CliFailure(`Cannot read ${file}. Check the path and try again.`, EXIT_USAGE);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliFailure(`${file} is not valid JSON: ${message}`, EXIT_INVALID_MODEL);
  }
}

function zodLines(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `error project.schema: ${where}${issue.message}`;
  });
}

async function loadProject(file: string): Promise<Project> {
  const raw = await readJson(file);
  try {
    return migrateProject(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new CliFailure(zodLines(error).join("\n"), EXIT_INVALID_MODEL);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliFailure(`error project.schema: ${message}`, EXIT_INVALID_MODEL);
  }
}

function errorsOf(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === "error");
}

async function runValidate(command: ValidateCommand, io: CliIO): Promise<number> {
  const project = await loadProject(command.projectPath);
  const issues = validateProject(project);
  const errors = errorsOf(issues);
  const warnings = issues.filter((issue) => issue.severity === "warning");

  if (command.json) {
    io.out(
      JSON.stringify(
        {
          command: "validate",
          project: command.projectPath,
          packageName: project.packageName,
          errors: errors.length,
          warnings: warnings.length,
          issues,
        },
        null,
        2,
      ),
    );
    return errors.length > 0 ? EXIT_INVALID_MODEL : EXIT_OK;
  }

  for (const issue of issues) io.err(issueLine(issue));
  io.out(
    `${project.name} (${project.packageName}): ${errors.length} errors, ${warnings.length} warnings`,
  );
  return errors.length > 0 ? EXIT_INVALID_MODEL : EXIT_OK;
}

function resolveTarget(root: string, relative: string): string {
  assertSafeRelativePath(relative);
  const resolved = path.resolve(root, relative);
  const inside = path.relative(root, resolved);
  if (inside === "" || inside.startsWith("..") || path.isAbsolute(inside)) {
    throw new CliFailure(
      `Refusing to write outside the target folder: ${relative}`,
      EXIT_WRITE_FAILED,
    );
  }
  return resolved;
}

async function readManifest(root: string): Promise<ProjectManifest | null> {
  const file = path.join(root, MANIFEST_FILE);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return null;
  }
  try {
    return parseProjectManifest(JSON.parse(text) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliFailure(
      `${MANIFEST_FILE} is not a valid manifest (${message}). Fix or remove it before generating.`,
      EXIT_WRITE_FAILED,
    );
  }
}

async function scanDisk(root: string, paths: string[]): Promise<DiskFileState[]> {
  const states: DiskFileState[] = [];
  for (const relative of paths) {
    const resolved = resolveTarget(root, relative);
    try {
      const info = await stat(resolved);
      if (!info.isFile()) continue;
      states.push({
        path: relative,
        sha256: await sha256(await readFile(resolved, "utf8")),
        mtime: info.mtimeMs,
      });
    } catch {
      continue;
    }
  }
  return states;
}

let tempCounter = 0;

async function writeAtomic(target: string, content: string): Promise<void> {
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  const temp = path.join(
    directory,
    `.${path.basename(target)}.chz-${process.pid}-${(tempCounter += 1)}.tmp`,
  );
  await writeFile(temp, content, "utf8");
  try {
    await rename(temp, target);
  } catch {
    await rm(target, { force: true });
    await rename(temp, target);
  }
}

interface WriteResult {
  written: string[];
  skipped: string[];
  failed: { path: string; error: string }[];
}

async function writeAll(root: string, writes: ExportWrite[]): Promise<WriteResult> {
  const result: WriteResult = { written: [], skipped: [], failed: [] };
  for (const write of writes) {
    if (write.strategy === "skip") {
      result.skipped.push(write.path);
      continue;
    }
    try {
      await writeAtomic(resolveTarget(root, write.path), write.content);
      result.written.push(write.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ path: write.path, error: message });
    }
  }
  return result;
}

async function runGenerate(command: GenerateCommand, io: CliIO): Promise<number> {
  const project = await loadProject(command.projectPath);
  const target = path.resolve(command.out ?? project.packageName);

  const generated = await generateProject(project, { format: command.format });
  const errors = errorsOf(generated.issues);
  if (errors.length > 0) {
    for (const issue of errors) io.err(issueLine(issue));
    io.err(`Invalid model: ${errors.length} errors. No files were written.`);
    return EXIT_INVALID_MODEL;
  }

  if (!command.dryRun) await mkdir(target, { recursive: true });
  const manifest = await readManifest(target);
  const disk = await scanDisk(
    target,
    generated.files.map((file) => file.path),
  );
  const plan = await buildExportPlan(generated.files, manifest, disk);
  const actions = conflictActions(plan, command.overwrite ? "overwrite" : "safe");
  const report = planReport(plan, actions);

  if (command.dryRun) {
    if (command.json) {
      io.out(
        JSON.stringify(
          {
            command: "generate",
            project: command.projectPath,
            target,
            dryRun: true,
            files: generated.files.length,
            counts: report.counts,
            conflicts: report.conflicts,
            warnings: generated.warnings,
          },
          null,
          2,
        ),
      );
    } else {
      io.out(`Target: ${target}`);
      io.out(`Plan: ${report.summary}`);
      for (const decision of report.conflicts) io.out(conflictLine(decision));
      io.out("Dry run: nothing was written.");
    }
    return EXIT_OK;
  }

  const writes = resolveExportWrites(plan, generated.files, actions);
  const result = await writeAll(target, writes);
  if (result.failed.length > 0) {
    if (command.json) {
      io.out(JSON.stringify({ command: "generate", target, failed: result.failed }, null, 2));
    } else {
      for (const failure of result.failed) io.err(`failed ${failure.path}: ${failure.error}`);
      io.err("The manifest was not updated. Fix the errors and run again.");
    }
    return EXIT_WRITE_FAILED;
  }

  const overrides = manifestOverrides(plan, manifest, actions);
  const { content } = await createManifest(
    project,
    generated.files,
    new Date(),
    overrides.hashes,
    overrides.omitted,
  );
  try {
    await writeAtomic(resolveTarget(target, MANIFEST_FILE), content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.err(`Could not write ${MANIFEST_FILE}: ${message}`);
    return EXIT_WRITE_FAILED;
  }

  for (const warning of generated.warnings) io.err(`warning format: ${warning}`);

  if (command.json) {
    io.out(
      JSON.stringify(
        {
          command: "generate",
          project: command.projectPath,
          target,
          dryRun: false,
          files: generated.files.length,
          counts: report.counts,
          written: result.written,
          skipped: result.skipped,
          conflicts: report.conflicts,
          warnings: generated.warnings,
        },
        null,
        2,
      ),
    );
  } else {
    io.out(`Generated ${project.name} in ${target}`);
    io.out(`Plan: ${report.summary}`);
    io.out(`${result.written.length} written, ${result.skipped.length} skipped`);
    for (const decision of report.conflicts) io.out(conflictLine(decision));
    if (report.conflicts.some((decision) => decision.action === "skip")) {
      io.out("Skipped files keep your local edits. Re-run with --overwrite to replace them.");
    }
  }

  return EXIT_OK;
}

async function runImport(cmd: ImportCommand, io: CliIO): Promise<number> {
  const absoluteSource = path.resolve(cmd.sourcePath);
  let content: string;
  try {
    content = await readFile(absoluteSource, "utf8");
  } catch {
    throw new CliFailure(`Cannot read ${cmd.sourcePath}. Check the path and try again.`, EXIT_USAGE);
  }

  let project: Project;
  try {
    project = importProject({
      format: cmd.format,
      content,
      projectName: cmd.name || path.basename(cmd.sourcePath, path.extname(cmd.sourcePath)),
      driver: cmd.driver,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CliFailure(`Import failed: ${msg}`, EXIT_INVALID_MODEL);
  }

  const issues = validateProject(project);
  const errors = errorsOf(issues);

  if (cmd.out) {
    const targetOut = path.resolve(cmd.out);
    await writeFile(targetOut, JSON.stringify(project, null, 2), "utf8");
    if (!cmd.json) {
      io.out(`Imported project saved to ${cmd.out} (${project.entities.length} entities, ${project.enums.length} enums)`);
    }
  }

  if (cmd.json) {
    io.out(JSON.stringify({ ok: errors.length === 0, project, issues }, null, 2));
  } else if (!cmd.out) {
    io.out(JSON.stringify(project, null, 2));
  }

  return errors.length === 0 ? EXIT_OK : EXIT_INVALID_MODEL;
}

export async function runCli(argv: readonly string[], io: CliIO = processIo): Promise<number> {
  let command: CliCommand;
  try {
    command = parseCliArgs(argv);
  } catch (error) {
    if (error instanceof CliUsageError) {
      io.err(error.message);
      io.err("");
      io.err(USAGE);
      return EXIT_USAGE;
    }
    throw error;
  }

  if (command.command === "help") {
    io.out(USAGE);
    return EXIT_OK;
  }
  if (command.command === "version") {
    io.out(`chz-nest ${GENERATOR_VERSION}`);
    return EXIT_OK;
  }
  if (command.command === "validate") return runValidate(command, io);
  if (command.command === "import") return runImport(command, io);
  return runGenerate(command, io);
}

/** Maps thrown CLI failures onto exit codes and prints them without a stack trace. */
export function reportFailure(error: unknown, io: CliIO = processIo): number {
  if (error instanceof CliFailure) {
    io.err(error.message);
    return error.exitCode;
  }
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  io.err(message);
  return EXIT_WRITE_FAILED;
}

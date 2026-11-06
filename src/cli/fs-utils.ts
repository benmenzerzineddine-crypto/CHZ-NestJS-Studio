import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ZodError } from "zod";
import {
  EXIT_INVALID_MODEL,
  EXIT_USAGE,
  EXIT_WRITE_FAILED,
} from "../core/cli/args";
import { assertSafeRelativePath } from "../core/cli/paths";
import {
  parseProjectManifest,
  sha256,
  type ProjectManifest,
} from "../core/export/manifest";
import type { DiskFileState } from "../core/export/plan";
import { migrateProject, type Project } from "../core/model/schema";
import type { ValidationIssue } from "../core/validate/validate";
import { CliFailure } from "./types";

export const MANIFEST_FILE = "chz-nest.json";

let tempCounter = 0;

export async function readJson(file: string): Promise<unknown> {
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

export function zodLines(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `error project.schema: ${where}${issue.message}`;
  });
}

export async function loadProject(file: string): Promise<Project> {
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

export function errorsOf(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === "error");
}

export function resolveTarget(root: string, relative: string): string {
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

export async function readManifest(root: string): Promise<ProjectManifest | null> {
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

export async function scanDisk(root: string, paths: string[]): Promise<DiskFileState[]> {
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

export async function writeAtomic(target: string, content: string): Promise<void> {
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

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  EXIT_INVALID_MODEL,
  EXIT_OK,
  EXIT_USAGE,
  type ImportCommand,
} from "../../core/cli/args";
import { importProject } from "../../core/import";
import type { Project } from "../../core/model/schema";
import { validateProject } from "../../core/validate/validate";
import { errorsOf } from "../fs-utils";
import { CliFailure, type CliIO } from "../types";

export async function runImport(
  cmd: ImportCommand,
  io: CliIO,
): Promise<number> {
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

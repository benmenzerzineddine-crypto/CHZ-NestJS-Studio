import { mkdir } from "node:fs/promises";
import path from "node:path";
import { conflictActions, conflictLine, issueLine, planReport } from "../../core/cli/actions";
import {
  EXIT_INVALID_MODEL,
  EXIT_OK,
  EXIT_WRITE_FAILED,
  type GenerateCommand,
} from "../../core/cli/args";
import {
  createManifest,
} from "../../core/export/manifest";
import {
  buildExportPlan,
  manifestOverrides,
  resolveExportWrites,
  type ExportWrite,
} from "../../core/export/plan";
import { generateProject } from "../../core/generate";
import {
  MANIFEST_FILE,
  errorsOf,
  loadProject,
  readManifest,
  resolveTarget,
  scanDisk,
  writeAtomic,
} from "../fs-utils";
import type { CliIO } from "../types";

export interface WriteResult {
  written: string[];
  skipped: string[];
  failed: { path: string; error: string }[];
}

export async function writeAll(
  root: string,
  writes: ExportWrite[],
): Promise<WriteResult> {
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

export async function runGenerate(
  command: GenerateCommand,
  io: CliIO,
): Promise<number> {
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

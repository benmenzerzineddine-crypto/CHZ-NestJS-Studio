/**
 * Node runner for the standalone CLI. All decision logic lives in
 * `src/core/cli/`; this orchestrator parses args and delegates to command handlers.
 */
import {
  CliUsageError,
  EXIT_OK,
  EXIT_USAGE,
  EXIT_WRITE_FAILED,
  USAGE,
  parseCliArgs,
  type CliCommand,
} from "../core/cli/args";
import { GENERATOR_VERSION } from "../core/version";
import { runGenerate } from "./commands/generate";
import { runImport } from "./commands/import";
import { runValidate } from "./commands/validate";
import { CliFailure, processIo, type CliIO } from "./types";

export { CliFailure, processIo, type CliIO };
export { runValidate } from "./commands/validate";
export { runGenerate } from "./commands/generate";
export { runImport } from "./commands/import";
export {
  MANIFEST_FILE,
  loadProject,
  readJson,
  readManifest,
  resolveTarget,
  scanDisk,
  writeAtomic,
} from "./fs-utils";

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

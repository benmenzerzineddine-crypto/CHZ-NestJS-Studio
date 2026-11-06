export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_INVALID_MODEL = 2;
export const EXIT_WRITE_FAILED = 3;

import type { ImportFormat } from "../import";
import type { Driver } from "../model/schema";

export interface GenerateCommand {
  command: "generate";
  projectPath: string;
  out: string | null;
  dryRun: boolean;
  overwrite: boolean;
  format: boolean;
  json: boolean;
}

export interface ValidateCommand {
  command: "validate";
  projectPath: string;
  json: boolean;
}

export interface ImportCommand {
  command: "import";
  sourcePath: string;
  format?: ImportFormat;
  out: string | null;
  name: string | null;
  driver?: Driver;
  json: boolean;
}

export interface HelpCommand {
  command: "help";
}

export interface VersionCommand {
  command: "version";
}

export type CliCommand = GenerateCommand | ValidateCommand | ImportCommand | HelpCommand | VersionCommand;

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

const HELP_FLAGS = new Set(["-h", "--help", "help"]);
const VERSION_FLAGS = new Set(["-v", "--version", "version"]);

interface RawFlags {
  out: string | null;
  dryRun: boolean;
  overwrite: boolean;
  raw: boolean;
  json: boolean;
  format?: ImportFormat;
  name: string | null;
  driver?: Driver;
}

function nextValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new CliUsageError(`Option "${flag}" needs a value.`);
  }
  return value;
}

/**
 * Parses CLI arguments without touching the filesystem so the whole surface is
 * unit-testable. Anything the user typed wrong throws `CliUsageError`.
 */
export function parseCliArgs(argv: readonly string[]): CliCommand {
  const [head, ...rest] = argv;
  if (head === undefined) return { command: "help" };
  if (HELP_FLAGS.has(head)) return { command: "help" };
  if (VERSION_FLAGS.has(head)) return { command: "version" };
  if (head !== "generate" && head !== "validate" && head !== "import") {
    throw new CliUsageError(`Unknown command "${head}". Use "generate", "validate", or "import".`);
  }

  const flags: RawFlags = {
    out: null,
    dryRun: false,
    overwrite: false,
    raw: false,
    json: false,
    name: null,
  };
  let projectPath: string | null = null;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index] as string;

    if (HELP_FLAGS.has(arg)) return { command: "help" };
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg === "--format") {
      if (head !== "import") throw new CliUsageError('Option "--format" is only valid for "import".');
      const val = nextValue(rest, index, arg);
      if (val !== "sql" && val !== "typeorm" && val !== "openapi") {
        throw new CliUsageError('Option "--format" must be "sql", "typeorm", or "openapi".');
      }
      flags.format = val;
      index += 1;
      continue;
    }
    if (arg === "--name") {
      if (head !== "import") throw new CliUsageError('Option "--name" is only valid for "import".');
      flags.name = nextValue(rest, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--driver") {
      if (head !== "import") throw new CliUsageError('Option "--driver" is only valid for "import".');
      const val = nextValue(rest, index, arg);
      if (val !== "postgres" && val !== "mysql" && val !== "sqlite") {
        throw new CliUsageError('Option "--driver" must be "postgres", "mysql", or "sqlite".');
      }
      flags.driver = val;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      if (head === "validate") throw new CliUsageError('Option "--out" is not valid for "validate".');
      flags.out = nextValue(rest, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      if (head !== "generate") {
        throw new CliUsageError('Option "--dry-run" is not valid for "validate".');
      }
      flags.dryRun = true;
      continue;
    }
    if (arg === "--overwrite") {
      if (head !== "generate") {
        throw new CliUsageError('Option "--overwrite" is not valid for "validate".');
      }
      flags.overwrite = true;
      continue;
    }
    if (arg === "--raw") {
      if (head !== "generate") throw new CliUsageError('Option "--raw" is not valid for "validate".');
      flags.raw = true;
      continue;
    }
    if (arg.startsWith("-")) throw new CliUsageError(`Unknown option "${arg}".`);
    if (projectPath !== null) {
      throw new CliUsageError(`Unexpected extra argument "${arg}".`);
    }
    projectPath = arg;
  }

  if (projectPath === null) {
    throw new CliUsageError("Missing project file. Pass the path to a project JSON file.");
  }

  if (head === "validate") {
    return { command: "validate", projectPath, json: flags.json };
  }

  if (head === "import") {
    return {
      command: "import",
      sourcePath: projectPath,
      format: flags.format,
      out: flags.out,
      name: flags.name,
      driver: flags.driver,
      json: flags.json,
    };
  }

  return {
    command: "generate",
    projectPath,
    out: flags.out,
    dryRun: flags.dryRun,
    overwrite: flags.overwrite,
    format: !flags.raw,
    json: flags.json,
  };
}

export const USAGE = `chz-nest — generate a NestJS + TypeORM API from a project JSON file

Usage:
  chz-nest generate <project.json> [--out <dir>] [--dry-run] [--overwrite] [--raw] [--json]
  chz-nest validate <project.json> [--json]
  chz-nest import <schema-file> [--format <sql|typeorm|openapi>] [--name <name>] [--driver <driver>] [--out <file.json>] [--json]
  chz-nest --help
  chz-nest --version

Options:
  --out <dir/file> Write into this folder or output file
  --format <fmt>   Import format: sql, typeorm, or openapi (default: auto-detected)
  --name <name>    Project name for import
  --driver <db>    Target driver: postgres, mysql, or sqlite (default: postgres)
  --dry-run        Print the export plan and write nothing
  --overwrite      Overwrite files changed on disk instead of skipping them
  --raw            Skip Prettier formatting (fast, not for exporting)
  --json           Print a machine-readable report
`;

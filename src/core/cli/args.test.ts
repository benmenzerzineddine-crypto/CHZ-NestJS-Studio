import { describe, expect, it } from "vitest";
import { CliUsageError, parseCliArgs } from "./args";

function errorFrom(argv: string[]): string {
  try {
    parseCliArgs(argv);
  } catch (error) {
    if (error instanceof CliUsageError) return error.message;
    throw error;
  }
  throw new Error("Expected a usage error");
}

describe("parseCliArgs", () => {
  it("prints help when invoked with no arguments", () => {
    expect(parseCliArgs([])).toEqual({ command: "help" });
  });

  it.each([["help"], ["-h"], ["--help"]])("treats %s as help", (flag) => {
    expect(parseCliArgs([flag])).toEqual({ command: "help" });
  });

  it.each([["-v"], ["--version"], ["version"]])("treats %s as version", (flag) => {
    expect(parseCliArgs([flag])).toEqual({ command: "version" });
  });

  it("parses a minimal generate command", () => {
    expect(parseCliArgs(["generate", "model.json"])).toEqual({
      command: "generate",
      projectPath: "model.json",
      out: null,
      dryRun: false,
      overwrite: false,
      format: true,
      json: false,
    });
  });

  it("parses every generate flag", () => {
    expect(
      parseCliArgs([
        "generate",
        "model.json",
        "--out",
        "out",
        "--dry-run",
        "--overwrite",
        "--raw",
        "--json",
      ]),
    ).toEqual({
      command: "generate",
      projectPath: "model.json",
      out: "out",
      dryRun: true,
      overwrite: true,
      format: false,
      json: true,
    });
  });

  it("parses validate", () => {
    expect(parseCliArgs(["validate", "model.json", "--json"])).toEqual({
      command: "validate",
      projectPath: "model.json",
      json: true,
    });
  });

  it("rejects an unknown command", () => {
    expect(errorFrom(["deploy", "model.json"])).toBe(
      'Unknown command "deploy". Use "generate", "validate", or "import".',
    );
  });

  it("rejects an unknown option", () => {
    expect(errorFrom(["generate", "model.json", "--force"])).toBe('Unknown option "--force".');
  });

  it("rejects a missing project file", () => {
    expect(errorFrom(["generate"])).toBe(
      "Missing project file. Pass the path to a project JSON file.",
    );
  });

  it("rejects an extra positional argument", () => {
    expect(errorFrom(["generate", "a.json", "b.json"])).toBe('Unexpected extra argument "b.json".');
  });

  it("rejects a missing option value", () => {
    expect(errorFrom(["generate", "model.json", "--out"])).toBe('Option "--out" needs a value.');
    expect(errorFrom(["generate", "model.json", "--out", "--dry-run"])).toBe(
      'Option "--out" needs a value.',
    );
  });

  it.each([["--out", "dir"], ["--dry-run"], ["--overwrite"], ["--raw"]])(
    "rejects the generate-only option %s for validate",
    (...flags: string[]) => {
      expect(errorFrom(["validate", "model.json", ...flags])).toBe(
        `Option "${flags[0]}" is not valid for "validate".`,
      );
    },
  );

  it("parses an import command with all flags", () => {
    expect(
      parseCliArgs([
        "import",
        "schema.sql",
        "--format",
        "sql",
        "--name",
        "Custom Import",
        "--driver",
        "postgres",
        "--out",
        "project.json",
        "--json",
      ]),
    ).toEqual({
      command: "import",
      sourcePath: "schema.sql",
      format: "sql",
      name: "Custom Import",
      driver: "postgres",
      out: "project.json",
      json: true,
    });
  });

  it("rejects invalid format option for import", () => {
    expect(errorFrom(["import", "schema.sql", "--format", "invalid"])).toBe(
      'Option "--format" must be "sql", "typeorm", or "openapi".',
    );
  });
});

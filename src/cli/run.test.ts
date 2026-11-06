// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateProject } from "../core/generate";
import { migrateProject } from "../core/model/schema";
import { runCli, type CliIO } from "./run";
import blog from "../core/fixtures/blog.json";

const fixture = fileURLToPath(new URL("../core/fixtures/blog.json", import.meta.url));

interface Captured {
  io: CliIO;
  out: string[];
  err: string[];
}

function capture(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (text) => out.push(text), err: (text) => err.push(text) }, out, err };
}

async function readTree(root: string, files: string[]): Promise<Map<string, string>> {
  const tree = new Map<string, string>();
  for (const file of files) {
    tree.set(file, await readFile(path.join(root, file), "utf8"));
  }
  return tree;
}

describe("runCli", () => {
  let workdir: string;
  let target: string;

  beforeEach(async () => {
    workdir = await mkdtemp(path.join(tmpdir(), "chz-cli-"));
    target = path.join(workdir, "out");
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it("writes exactly the files generateProject produces", async () => {
    const captured = capture();
    const code = await runCli(["generate", fixture, "--out", target], captured.io);
    expect(code).toBe(0);

    const expected = await generateProject(migrateProject(blog));
    const written = await readTree(
      target,
      expected.files.map((file) => file.path),
    );

    expect(written.size).toBe(expected.files.length);
    for (const file of expected.files) {
      expect(written.get(file.path), file.path).toBe(file.content);
    }

    const manifest = JSON.parse(await readFile(path.join(target, "chz-nest.json"), "utf8")) as {
      files: Record<string, string>;
    };
    expect(Object.keys(manifest.files)).toHaveLength(expected.files.length);
    expect(manifest.files["src/main.ts"]).toBeDefined();
  }, 60_000);

  it("skips everything on a second run", async () => {
    await runCli(["generate", fixture, "--out", target], capture().io);
    const expected = await generateProject(migrateProject(blog));
    const captured = capture();

    const code = await runCli(["generate", fixture, "--out", target], captured.io);

    expect(code).toBe(0);
    expect(captured.out).toContain(`Plan: 0 new · ${expected.files.length} unchanged`);
    expect(captured.out).toContain(`0 written, ${expected.files.length} skipped`);
  }, 60_000);

  it("keeps local edits unless --overwrite is passed", async () => {
    await runCli(["generate", fixture, "--out", target], capture().io);
    const edited = path.join(target, "src/main.ts");
    const original = await readFile(edited, "utf8");
    await writeFile(edited, `${original}\n// local edit\n`, "utf8");

    const skipped = capture();
    await runCli(["generate", fixture, "--out", target], skipped.io);
    expect(await readFile(edited, "utf8")).toContain("// local edit");
    expect(skipped.out).toContain("skip src/main.ts (changed on disk)");

    const forced = capture();
    await runCli(["generate", fixture, "--out", target, "--overwrite"], forced.io);
    expect(await readFile(edited, "utf8")).toBe(original);
    expect(forced.out).toContain("overwrite src/main.ts (changed on disk)");
  }, 60_000);

  it("writes nothing when the model has validation errors", async () => {
    const broken = structuredClone(blog) as typeof blog;
    broken.entities[1]!.options.searchFields = ["missingField"];
    const modelPath = path.join(workdir, "broken.json");
    await writeFile(modelPath, JSON.stringify(broken), "utf8");

    const captured = capture();
    const code = await runCli(["generate", modelPath, "--out", target], captured.io);

    expect(code).toBe(2);
    expect(captured.err.join("\n")).toContain("entity.search.invalid");
    expect(await readdir(target).catch(() => [])).toEqual([]);
  }, 60_000);

  it("validates the fixture without issues", async () => {
    const captured = capture();
    const code = await runCli(["validate", fixture], captured.io);

    expect(code).toBe(0);
    expect(captured.out).toContain("Blog API (blog-api): 0 errors, 0 warnings");
  });

  it("prints a machine-readable report in --json mode", async () => {
    const expected = await generateProject(migrateProject(blog));
    const captured = capture();
    const code = await runCli(["generate", fixture, "--out", target, "--dry-run", "--json"], captured.io);

    expect(code).toBe(0);
    const report = JSON.parse(captured.out.join("\n")) as {
      dryRun: boolean;
      files: number;
      counts: { new: number };
    };
    expect(report.dryRun).toBe(true);
    expect(report.files).toBe(expected.files.length);
    expect(report.counts.new).toBe(expected.files.length);
  }, 60_000);

  it("returns a usage error for unknown flags", async () => {
    const captured = capture();
    const code = await runCli(["generate", fixture, "--nope"], captured.io);

    expect(code).toBe(1);
    expect(captured.err[0]).toBe('Unknown option "--nope".');
  });
});

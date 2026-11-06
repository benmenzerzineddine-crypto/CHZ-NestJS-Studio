import { describe, expect, it } from "vitest";
import type { GeneratedFile } from "../ir/types";
import type { ProjectManifest } from "./manifest";
import { sha256 } from "./manifest";
import {
  buildExportPlan,
  manifestOverrides,
  newFilePath,
  resolveExportWrites,
  type DiskFileState,
} from "./plan";

function generated(path: string, content: string): GeneratedFile {
  return { path, content, kind: "typescript" };
}

function manifest(files: Record<string, string>): ProjectManifest {
  return {
    generator: "chz-nest",
    generatorVersion: "0.0.0",
    projectId: "prj_test",
    modelHash: "model",
    createdAt: "2026-01-01T00:00:00.000Z",
    files,
  };
}

describe("buildExportPlan", () => {
  it("classifies new files when no manifest exists", async () => {
    const files = [generated("src/a.ts", "a"), generated("src/b.ts", "b")];
    const plan = await buildExportPlan(files, null, []);

    expect(plan.counts.new).toBe(2);
    expect(plan.entries.every((entry) => entry.status === "new")).toBe(true);
    expect(plan.entries.every((entry) => entry.defaultStrategy === "overwrite")).toBe(true);
  });

  it("classifies untracked files when no manifest exists but the file is on disk", async () => {
    const file = generated("src/a.ts", "a");
    const plan = await buildExportPlan([file], null, [
      { path: file.path, sha256: "unmanaged", mtime: 1 },
    ]);

    expect(plan.counts.untracked).toBe(1);
    expect(plan.entries[0]).toMatchObject({
      status: "untracked",
      defaultStrategy: "skip",
      existingSha256: "unmanaged",
    });
  });

  it("distinguishes generator updates from local disk changes", async () => {
    const unchanged = generated("src/unchanged.ts", "same");
    const generatorUpdated = generated("src/generator.ts", "new generated");
    const diskModified = generated("src/local.ts", "new generated");
    const bothModified = generated("src/both.ts", "new generated");
    const missing = generated("src/missing.ts", "missing");
    const newFile = generated("src/new.ts", "new");
    const disk: DiskFileState[] = [
      { path: unchanged.path, sha256: await sha256(unchanged.content), mtime: 1 },
      { path: generatorUpdated.path, sha256: await sha256("old generated"), mtime: 2 },
      { path: diskModified.path, sha256: await sha256("local edit"), mtime: 3 },
      { path: bothModified.path, sha256: await sha256("local edit"), mtime: 4 },
    ];
    const source = manifest({
      [unchanged.path]: disk[0].sha256,
      [generatorUpdated.path]: await sha256("old generated"),
      [diskModified.path]: await sha256("old generated"),
      [bothModified.path]: await sha256("old generated"),
      [missing.path]: "missing-hash",
    });

    const plan = await buildExportPlan(
      [unchanged, generatorUpdated, diskModified, bothModified, missing, newFile],
      source,
      disk,
    );
    expect(plan.counts).toEqual({
      new: 1,
      untracked: 0,
      unchanged: 1,
      "generator-updated": 1,
      "disk-modified": 2,
      "missing-from-disk": 1,
    });

    const byPath = new Map(plan.entries.map((entry) => [entry.path, entry]));
    expect(byPath.get(unchanged.path)?.status).toBe("unchanged");
    expect(byPath.get(unchanged.path)?.defaultStrategy).toBe("skip");
    expect(byPath.get(generatorUpdated.path)?.status).toBe("generator-updated");
    expect(byPath.get(generatorUpdated.path)?.defaultStrategy).toBe("overwrite");
    expect(byPath.get(diskModified.path)?.status).toBe("disk-modified");
    expect(byPath.get(bothModified.path)?.status).toBe("disk-modified");
    expect(byPath.get(diskModified.path)?.defaultStrategy).toBe("skip");
    expect(byPath.get(missing.path)?.status).toBe("missing-from-disk");
    expect(byPath.get(missing.path)?.defaultStrategy).toBe("overwrite");
    expect(byPath.get(newFile.path)?.status).toBe("new");
  });

  it("keeps the plan deterministic regardless of input order", async () => {
    const files = [generated("src/b.ts", "b"), generated("src/a.ts", "a")];
    const first = await buildExportPlan(files, null, []);
    const second = await buildExportPlan([...files].reverse(), null, []);
    expect(first.entries.map((entry) => entry.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(second.entries).toEqual(first.entries);
  });
});

describe("resolveExportWrites", () => {
  it("writes new and missing files, skips unchanged files, and skips conflicts by default", async () => {
    const oldHash = await sha256("old content");
    const localHash = await sha256("local edit");
    const files = [
      generated("src/new.ts", "new"),
      generated("src/unchanged.ts", "same"),
      generated("src/conflict.ts", "new content"),
      generated("src/missing.ts", "missing"),
    ];
    const source = manifest({
      "src/unchanged.ts": await sha256("same"),
      "src/conflict.ts": oldHash,
      "src/missing.ts": "missing",
    });
    const disk: DiskFileState[] = [
      { path: "src/unchanged.ts", sha256: await sha256("same"), mtime: 1 },
      { path: "src/conflict.ts", sha256: localHash, mtime: 2 },
    ];
    const plan = await buildExportPlan(files, source, disk);

    expect(resolveExportWrites(plan, files)).toEqual([
      { path: "src/conflict.ts", content: "new content", strategy: "skip" },
      { path: "src/missing.ts", content: "missing", strategy: "overwrite" },
      { path: "src/new.ts", content: "new", strategy: "overwrite" },
      { path: "src/unchanged.ts", content: "same", strategy: "skip" },
    ]);
  });

  it("supports overwrite, skip and .new conflict actions", async () => {
    const oldHash = await sha256("old content");
    const localHash = await sha256("local edit");
    const file = generated("src/conflict.ts", "new content");
    const plan = await buildExportPlan([file], manifest({ "src/conflict.ts": oldHash }), [
      { path: "src/conflict.ts", sha256: localHash, mtime: 1 },
    ]);

    expect(resolveExportWrites(plan, [file], { "src/conflict.ts": "overwrite" })).toEqual([
      { path: "src/conflict.ts", content: "new content", strategy: "overwrite" },
    ]);
    expect(resolveExportWrites(plan, [file], { "src/conflict.ts": "skip" })).toEqual([
      { path: "src/conflict.ts", content: "new content", strategy: "skip" },
    ]);
    expect(resolveExportWrites(plan, [file], { "src/conflict.ts": "new" })).toEqual([
      { path: newFilePath("src/conflict.ts"), content: "new content", strategy: "overwrite" },
    ]);
  });
});

describe("manifestOverrides", () => {
  it("keeps the old manifest hash when a local edit is skipped or written as .new", async () => {
    const file = generated("src/conflict.ts", "new content");
    const source = manifest({ "src/conflict.ts": "old-manifest-hash" });
    const plan = await buildExportPlan([file], source, [
      { path: "src/conflict.ts", sha256: "local-disk-hash", mtime: 1 },
    ]);

    expect(manifestOverrides(plan, source)).toEqual({
      hashes: { "src/conflict.ts": "old-manifest-hash" },
      omitted: [],
    });
    expect(manifestOverrides(plan, source, { "src/conflict.ts": "new" })).toEqual({
      hashes: { "src/conflict.ts": "old-manifest-hash" },
      omitted: [],
    });
    expect(manifestOverrides(plan, source, { "src/conflict.ts": "overwrite" })).toEqual({
      hashes: {},
      omitted: [],
    });
  });

  it("omits untracked files that are not adopted", async () => {
    const file = generated("src/untracked.ts", "generated");
    const plan = await buildExportPlan([file], null, [
      { path: file.path, sha256: "local", mtime: 1 },
    ]);

    expect(manifestOverrides(plan, null)).toEqual({
      hashes: {},
      omitted: ["src/untracked.ts"],
    });
    expect(manifestOverrides(plan, null, { "src/untracked.ts": "new" })).toEqual({
      hashes: {},
      omitted: ["src/untracked.ts"],
    });
    expect(manifestOverrides(plan, null, { "src/untracked.ts": "overwrite" })).toEqual({
      hashes: {},
      omitted: [],
    });
  });

  it("does not override safe writes", async () => {
    const files = [
      generated("src/new.ts", "new"),
      generated("src/updated.ts", "new"),
      generated("src/unchanged.ts", "same"),
    ];
    const source = manifest({
      "src/updated.ts": await sha256("old"),
      "src/unchanged.ts": await sha256("same"),
    });
    const plan = await buildExportPlan(files, source, [
      { path: "src/updated.ts", sha256: await sha256("old"), mtime: 1 },
      { path: "src/unchanged.ts", sha256: await sha256("same"), mtime: 2 },
    ]);

    expect(manifestOverrides(plan, source)).toEqual({ hashes: {}, omitted: [] });
  });
});

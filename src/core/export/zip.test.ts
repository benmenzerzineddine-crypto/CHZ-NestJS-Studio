// @vitest-environment node
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { GeneratedFile } from "../ir/types";
import type { Project } from "../model/schema";
import { projectSchema } from "../model/schema";
import blogJson from "../fixtures/blog.json";
import { createProjectZip } from "./zip";
import { createManifest } from "./manifest";
import { generateProject } from "../generate";

const project: Project = projectSchema.parse(blogJson);
const files: GeneratedFile[] = [
  { path: "src/b.ts", content: "export const b = 2;\n", kind: "typescript" },
  { path: "src/a.ts", content: "export const a = 1;\n", kind: "typescript" },
  { path: "README.md", content: "# test\n", kind: "markdown" },
];

describe("createManifest", () => {
  it("lists files sorted with sha256 hashes and byte sizes", async () => {
    const { manifest, content } = await createManifest(
      project,
      files,
      new Date("2026-01-02T03:04:05.000Z"),
    );

    expect(manifest.generator).toBe("chz-nest");
    expect(manifest.projectId).toBe(project.id);
    expect(manifest.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(manifest.modelHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(manifest.files)).toEqual(["README.md", "src/a.ts", "src/b.ts"]);
    for (const hash of Object.values(manifest.files)) {
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(JSON.parse(content)).toEqual(manifest);
  });

  it("changes the model hash when the model changes", async () => {
    const first = await createManifest(project, files, new Date(0));
    const changed = structuredClone(project);
    changed.name = "Different";
    const second = await createManifest(changed, files, new Date(0));
    expect(second.manifest.modelHash).not.toBe(first.manifest.modelHash);
  });

  it("honors preserved hashes for files skipped during export", async () => {
    const preserved = "a".repeat(64);
    const { manifest } = await createManifest(project, files, new Date(0), {
      "src/a.ts": preserved,
    });
    expect(manifest.files["src/a.ts"]).toBe(preserved);
    expect(manifest.files["src/b.ts"]).not.toBe(preserved);
  });

  it("omits untracked files that were not adopted", async () => {
    const { manifest } = await createManifest(
      project,
      files,
      new Date(0),
      {},
      ["src/b.ts"],
    );
    expect(Object.keys(manifest.files)).toEqual(["README.md", "src/a.ts"]);
  });
});

describe("createProjectZip", () => {
  it("zips the complete blog tree and a matching manifest", async () => {
    const generated = await generateProject(project);
    const result = await createProjectZip(project, generated.files, new Date("2026-01-02T03:04:05.000Z"));
    const entries = unzipSync(result.zip);
    const expectedPaths = generated.files.map((file) => file.path).sort();

    expect(Object.keys(entries).sort()).toEqual([...expectedPaths, "chz-nest.json"].sort());
    const manifest = JSON.parse(strFromU8(entries["chz-nest.json"]));
    expect(Object.keys(manifest.files).sort()).toEqual(expectedPaths);
    expect(manifest.projectId).toBe(project.id);
  }, 20_000);

  it("contains every generated file plus the manifest", async () => {
    const result = await createProjectZip(project, files, new Date("2026-01-02T03:04:05.000Z"));
    expect(result.fileName).toBe("blog-api-2026-01-02.zip");

    const entries = unzipSync(result.zip);
    expect(Object.keys(entries).sort()).toEqual([
      "README.md",
      "chz-nest.json",
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(strFromU8(entries["src/a.ts"])).toBe("export const a = 1;\n");
    expect(JSON.parse(strFromU8(entries["chz-nest.json"]))).toEqual(JSON.parse(result.manifest));
  });
});

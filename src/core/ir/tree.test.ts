import { describe, expect, it } from "vitest";
import type { GeneratedFile } from "./types";
import { buildFileTree, flattenFileTree, treeByteSize, treeFileCount } from "./tree";

const files: GeneratedFile[] = [
  { path: "src/modules/post/post.service.ts", content: "export const post = 1;\n", kind: "typescript" },
  { path: "README.md", content: "# demo\n", kind: "markdown" },
  { path: "src/main.ts", content: "export const main = true;\n", kind: "typescript" },
  { path: "src/modules/post/post.module.ts", content: "export const mod = 1;\n", kind: "typescript" },
];

describe("buildFileTree", () => {
  it("groups files by folder and sorts every level", () => {
    const tree = buildFileTree(files, "demo-api");
    expect(tree.name).toBe("demo-api");
    expect(tree.path).toBe("");
    expect(tree.files.map((file) => file.path)).toEqual(["README.md"]);
    expect(tree.children.map((child) => child.name)).toEqual(["src"]);
    const src = tree.children[0];
    expect(src.files.map((file) => file.path)).toEqual(["src/main.ts"]);
    expect(src.children.map((child) => child.name)).toEqual(["modules"]);
    expect(src.children[0].children.map((child) => child.name)).toEqual(["post"]);
  });

  it("flattens back to deterministically sorted file paths", () => {
    const tree = buildFileTree(files, "demo-api");
    expect(flattenFileTree(tree).map((file) => file.path)).toEqual([
      "README.md",
      "src/main.ts",
      "src/modules/post/post.module.ts",
      "src/modules/post/post.service.ts",
    ]);
  });

  it("counts files and UTF-8 bytes", () => {
    const tree = buildFileTree(files, "demo-api");
    expect(treeFileCount(tree)).toBe(4);
    expect(treeByteSize(tree)).toBe(
      files.reduce((total, file) => total + new TextEncoder().encode(file.content).length, 0),
    );
  });
});

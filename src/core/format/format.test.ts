// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatFiles } from "./format";

describe("formatFiles", () => {
  it("formats TypeScript and JSON with Prettier", async () => {
    const result = await formatFiles([
      { path: "src/a.ts", content: "export const x={a:1,b:2}", kind: "typescript" },
      { path: "package.json", content: '{"name":"x","private":true}', kind: "json" },
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.files[0].content).toContain("export const x = { a: 1, b: 2 };");
    expect(result.files[1].content).toContain('"name": "x"');
  });

  it("passes through files that have no formatter", async () => {
    const file = { path: "README.md", content: "# hi\n", kind: "markdown" as const };
    const result = await formatFiles([file]);
    expect(result.files).toEqual([file]);
    expect(result.warnings).toEqual([]);
  });

  it("keeps raw content and reports a warning when parsing fails", async () => {
    const raw = "export const = ;";
    const result = await formatFiles([{ path: "src/broken.ts", content: raw, kind: "typescript" }]);
    expect(result.files[0].content).toBe(raw);
    expect(result.warnings[0]).toContain("src/broken.ts");
  });
});

import { describe, expect, it } from "vitest";
import { assertSafeRelativePath } from "./paths";

describe("assertSafeRelativePath", () => {
  it("accepts a nested generated path", () => {
    expect(assertSafeRelativePath("src/modules/post/post.service.ts")).toBe(
      "src/modules/post/post.service.ts",
    );
  });

  it.each([
    "",
    "/etc/passwd",
    "C:/windows/system32",
    "..\\..\\secret",
    "src/../../outside.ts",
    "./src/main.ts",
    "src//main.ts",
    "src/main.ts\0",
  ])("rejects %j", (value) => {
    expect(() => assertSafeRelativePath(value)).toThrow();
  });
});

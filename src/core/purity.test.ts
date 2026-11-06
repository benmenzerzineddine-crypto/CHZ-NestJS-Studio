// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const coreRoot = fileURLToPath(new URL(".", import.meta.url));

async function sources(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await sources(full)));
      continue;
    }
    if (entry.name.endsWith(".test.ts") || !entry.name.endsWith(".ts")) continue;
    found.push(full);
  }
  return found;
}

function nodeImports(text: string, fileName: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  const modules: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    if (specifier.startsWith("node:")) modules.push(specifier);
  }
  return modules;
}

describe("core purity", () => {
  it("keeps src/core free of node: imports so the CLI and browser share it", async () => {
    const offenders: string[] = [];
    for (const file of await sources(coreRoot)) {
      const text = await readFile(file, "utf8");
      if (nodeImports(text, file).length > 0) offenders.push(path.relative(coreRoot, file));
    }

    expect(offenders).toEqual([]);
  });
});

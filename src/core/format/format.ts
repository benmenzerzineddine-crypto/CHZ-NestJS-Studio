import type { GeneratedFile } from "../ir/types";

export interface FormatResult {
  files: GeneratedFile[];
  warnings: string[];
}

type PrettierRuntime = {
  format: typeof import("prettier/standalone").format;
  plugins: import("prettier").Plugin[];
};

let prettierPromise: Promise<PrettierRuntime> | undefined;
const formatCache = new Map<string, string>();

function loadPrettier(): Promise<PrettierRuntime> {
  prettierPromise ??= (async () => {
    const [standalone, typescript, estree, babel] = await Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/typescript"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/babel"),
    ]);
    return {
      format: standalone.format,
      plugins: [typescript, estree, babel] as unknown as import("prettier").Plugin[],
    };
  })();
  return prettierPromise;
}

function parserFor(file: GeneratedFile): string | undefined {
  if (file.path.endsWith(".ts")) return "typescript";
  if (file.path.endsWith(".tsx")) return "typescript";
  if (file.path.endsWith(".js")) return "babel";
  if (file.path.endsWith(".json")) return "json";
  return undefined;
}

export async function formatFiles(files: GeneratedFile[]): Promise<FormatResult> {
  const prettier = await loadPrettier();
  const warnings: string[] = [];
  const formatted: GeneratedFile[] = [];

  for (const file of files) {
    const parser = parserFor(file);
    if (!parser) {
      formatted.push(file);
      continue;
    }

    const cacheKey = `${parser}\u0000${file.content}`;
    const cached = formatCache.get(cacheKey);
    if (cached !== undefined) {
      formatted.push({ ...file, content: cached });
      continue;
    }

    try {
      const content = await prettier.format(file.content, {
        parser,
        plugins: prettier.plugins,
        printWidth: 100,
        semi: true,
        singleQuote: false,
        trailingComma: "all",
      });
      if (formatCache.size > 2_000) formatCache.clear();
      formatCache.set(cacheKey, content);
      formatted.push({ ...file, content });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Could not format ${file.path}: ${message}`);
      formatted.push(file);
    }
  }

  return { files: formatted, warnings };
}

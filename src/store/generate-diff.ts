import type { GenerateResult } from "@/core/generate";

export type ViewMode = "code" | "diff";

export interface FileDiffInfo {
  path: string;
  original: string | null;
  modified: string;
  status: "added" | "modified" | "unchanged";
}

export interface DiffSummary {
  added: number;
  modified: number;
  unchanged: number;
}

export function computeFileDiff(
  path: string,
  result: GenerateResult | null,
  previousResult: GenerateResult | null,
): FileDiffInfo | null {
  if (!result) return null;
  const modifiedFile = result.files.find((f) => f.path === path);
  if (!modifiedFile) return null;

  if (!previousResult) {
    return {
      path,
      original: null,
      modified: modifiedFile.content,
      status: "added",
    };
  }

  const originalFile = previousResult.files.find((f) => f.path === path);
  if (!originalFile) {
    return {
      path,
      original: null,
      modified: modifiedFile.content,
      status: "added",
    };
  }

  if (originalFile.content === modifiedFile.content) {
    return {
      path,
      original: originalFile.content,
      modified: modifiedFile.content,
      status: "unchanged",
    };
  }

  return {
    path,
    original: originalFile.content,
    modified: modifiedFile.content,
    status: "modified",
  };
}

export function computeFileDiffStatus(
  path: string,
  result: GenerateResult | null,
  previousResult: GenerateResult | null,
): "added" | "modified" | "unchanged" | null {
  if (!result || !previousResult) return null;
  const modifiedFile = result.files.find((f) => f.path === path);
  if (!modifiedFile) return null;
  const originalFile = previousResult.files.find((f) => f.path === path);
  if (!originalFile) return "added";
  return originalFile.content === modifiedFile.content ? "unchanged" : "modified";
}

export function computeDiffSummary(
  result: GenerateResult | null,
  previousResult: GenerateResult | null,
): DiffSummary {
  if (!result || !previousResult) {
    return { added: 0, modified: 0, unchanged: result?.files.length ?? 0 };
  }
  let added = 0;
  let modified = 0;
  let unchanged = 0;
  const prevMap = new Map(previousResult.files.map((f) => [f.path, f.content]));
  for (const file of result.files) {
    const prev = prevMap.get(file.path);
    if (prev === undefined) added++;
    else if (prev === file.content) unchanged++;
    else modified++;
  }
  return { added, modified, unchanged };
}

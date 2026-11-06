import type { GeneratedFile } from "../ir/types";
import { sha256, type ProjectManifest } from "./manifest";

export type ExportEntryStatus =
  | "new"
  | "untracked"
  | "unchanged"
  | "generator-updated"
  | "disk-modified"
  | "missing-from-disk";
export type ExportStrategy = "overwrite" | "skip";
export type ConflictAction = "overwrite" | "skip" | "new";

export interface DiskFileState {
  path: string;
  sha256: string;
  mtime: number;
}

export interface ExportPlanEntry {
  path: string;
  sha256: string;
  status: ExportEntryStatus;
  defaultStrategy: ExportStrategy;
  existingSha256?: string;
  mtime?: number;
}

export interface ExportPlan {
  entries: ExportPlanEntry[];
  counts: Record<ExportEntryStatus, number>;
}

export interface ExportWrite {
  path: string;
  content: string;
  strategy: ExportStrategy;
}

export interface ManifestOverrides {
  hashes: Record<string, string>;
  omitted: string[];
}

const CONFLICT_STATUSES = new Set<ExportEntryStatus>(["disk-modified", "untracked"]);

export function isConflictStatus(status: ExportEntryStatus): boolean {
  return CONFLICT_STATUSES.has(status);
}

export async function buildExportPlan(
  files: GeneratedFile[],
  manifest: ProjectManifest | null,
  disk: DiskFileState[],
): Promise<ExportPlan> {
  const diskByPath = new Map(disk.map((file) => [file.path, file]));
  const counts: Record<ExportEntryStatus, number> = {
    new: 0,
    untracked: 0,
    unchanged: 0,
    "generator-updated": 0,
    "disk-modified": 0,
    "missing-from-disk": 0,
  };

  const entries: ExportPlanEntry[] = [];
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const hash = await sha256(file.content);
    const manifestSha = manifest?.files[file.path];
    const diskFile = diskByPath.get(file.path);

    let status: ExportEntryStatus;
    if (!manifest || manifestSha === undefined) {
      status = diskFile ? "untracked" : "new";
    } else if (!diskFile) {
      status = "missing-from-disk";
    } else if (diskFile.sha256 === hash) {
      status = "unchanged";
    } else if (diskFile.sha256 === manifestSha) {
      status = "generator-updated";
    } else {
      status = "disk-modified";
    }

    const defaultStrategy: ExportStrategy = isConflictStatus(status)
      ? "skip"
      : status === "unchanged"
        ? "skip"
        : "overwrite";

    counts[status] += 1;
    entries.push({
      path: file.path,
      sha256: hash,
      status,
      defaultStrategy,
      existingSha256: diskFile?.sha256,
      mtime: diskFile?.mtime,
    });
  }

  return { entries, counts };
}

export function newFilePath(path: string): string {
  return `${path}.new`;
}

export function resolveExportWrites(
  plan: ExportPlan,
  files: GeneratedFile[],
  actions: Record<string, ConflictAction> = {},
): ExportWrite[] {
  const contentByPath = new Map(files.map((file) => [file.path, file.content]));
  const writes: ExportWrite[] = [];

  for (const entry of plan.entries) {
    const content = contentByPath.get(entry.path);
    if (content === undefined) continue;

    if (entry.status === "unchanged") {
      writes.push({ path: entry.path, content, strategy: "skip" });
      continue;
    }

    const action: ConflictAction = isConflictStatus(entry.status)
      ? (actions[entry.path] ?? "skip")
      : "overwrite";

    if (action === "new") {
      writes.push({ path: newFilePath(entry.path), content, strategy: "overwrite" });
    } else {
      writes.push({ path: entry.path, content, strategy: action === "skip" ? "skip" : "overwrite" });
    }
  }

  return writes;
}

/**
 * Keeps the manifest anchored to the last content the generator actually wrote.
 * Skipped local edits keep their old manifest hash so they stay visible as conflicts
 * on the next export; untracked files are omitted entirely.
 */
export function manifestOverrides(
  plan: ExportPlan,
  manifest: ProjectManifest | null,
  actions: Record<string, ConflictAction> = {},
): ManifestOverrides {
  const hashes: Record<string, string> = {};
  const omitted: string[] = [];

  for (const entry of plan.entries) {
    if (!isConflictStatus(entry.status)) continue;

    const action = actions[entry.path] ?? "skip";
    if (action === "overwrite") continue;

    if (entry.status === "untracked") {
      omitted.push(entry.path);
      continue;
    }

    const previousHash = manifest?.files[entry.path];
    if (previousHash) hashes[entry.path] = previousHash;
  }

  return { hashes, omitted };
}

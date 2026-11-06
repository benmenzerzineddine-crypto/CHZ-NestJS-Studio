import { invokeCommand } from "./tauri";

export type WriteStrategy = "overwrite" | "skip";

export interface FileWrite {
  path: string;
  content: string;
  strategy: WriteStrategy;
}

export interface FileFailure {
  path: string;
  error: string;
}

export interface WriteReport {
  written: string[];
  skipped: string[];
  failed: FileFailure[];
}

/** Writes a generated file tree into a user-selected folder (desktop only). */
export async function writeFiles(root: string, files: FileWrite[]): Promise<WriteReport> {
  return invokeCommand<WriteReport>("write_files", { root, files });
}

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { DiskFileState } from "@/core/export/plan";

export class AppError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.cause = cause;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unexpected error";
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new AppError(`"${command}" is only available in the desktop app`);
  }

  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new AppError(errorMessage(error), error);
  }
}

export interface ReadManifestResult {
  manifest: unknown;
  existing: DiskFileState[];
  isEmpty: boolean;
  hasManifest: boolean;
}

export async function pickExportFolder(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new AppError("Choosing a folder is only available in the desktop app");
  }

  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose export folder",
    });
    return typeof selected === "string" ? selected : null;
  } catch (error) {
    throw new AppError(errorMessage(error), error);
  }
}

export async function readManifest(
  folder: string,
  paths: string[],
): Promise<ReadManifestResult> {
  return invokeCommand<ReadManifestResult>("read_manifest", { root: folder, paths });
}

export async function revealPath(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new AppError("Revealing a folder is only available in the desktop app");
  }

  try {
    await revealItemInDir(path);
  } catch (error) {
    throw new AppError(errorMessage(error), error);
  }
}


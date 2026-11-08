import { create } from "zustand";
import { createProjectZip } from "@/core/export/zip";
import { generateProject, type GenerateResult } from "@/core/generate";
import type { Project } from "@/core/model/schema";
import { errorMessage } from "@/lib/tauri";
import { useProjectStore } from "./project.store";
import { useUiStore } from "./ui.store";
import {
  type ViewMode,
  type FileDiffInfo,
  type DiffSummary,
  computeFileDiff,
  computeFileDiffStatus,
  computeDiffSummary,
} from "./generate-diff";

export type { ViewMode, FileDiffInfo, DiffSummary };

export type GenerateStatus = "idle" | "running" | "ready" | "error";

export interface ExportRecord {
  revision: number;
  path: string;
}

export interface PersistedGeneration {
  projectId: string;
  revision: number | null;
  projectSnapshot: Project | null;
  result: GenerateResult | null;
  previousResult: GenerateResult | null;
  selectedPath?: string;
  exportRecord?: ExportRecord;
  updatedAt?: string;
}

const GENERATION_STORAGE_PREFIX = "chz-nest:generation:";

function pruneOldGenerations(currentProjectId: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const entries: { key: string; updatedAt: string }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        key.startsWith(GENERATION_STORAGE_PREFIX) &&
        key !== `${GENERATION_STORAGE_PREFIX}${currentProjectId}`
      ) {
        try {
          const item = window.localStorage.getItem(key);
          const parsed = item ? (JSON.parse(item) as Partial<PersistedGeneration>) : null;
          entries.push({ key, updatedAt: parsed?.updatedAt ?? "" });
        } catch {
          entries.push({ key, updatedAt: "" });
        }
      }
    }
    entries.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    if (entries.length > 0 && entries[0]) {
      window.localStorage.removeItem(entries[0].key);
    }
  } catch {
    // Ignore storage errors safely
  }
}

export function saveGeneration(data: PersistedGeneration): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const key = `${GENERATION_STORAGE_PREFIX}${data.projectId}`;
    const payload: PersistedGeneration = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      pruneOldGenerations(data.projectId);
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        if (payload.previousResult) {
          window.localStorage.setItem(
            key,
            JSON.stringify({ ...payload, previousResult: null }),
          );
        }
      }
    }
  } catch {
    // Ignore storage errors safely
  }
}

export function loadGeneration(projectId: string): PersistedGeneration | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const key = `${GENERATION_STORAGE_PREFIX}${projectId}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGeneration;
    if (parsed.projectId !== projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGeneration(projectId: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(`${GENERATION_STORAGE_PREFIX}${projectId}`);
  } catch {
    // Ignore
  }
}

export interface RunGenerateOptions {
  silent?: boolean;
}

interface GenerateStore {
  status: GenerateStatus;
  projectId: string | null;
  revision: number | null;
  projectSnapshot: Project | null;
  result: GenerateResult | null;
  previousResult: GenerateResult | null;
  viewMode: ViewMode;
  formatting: boolean;
  selectedByProject: Record<string, string>;
  exportedByProject: Record<string, ExportRecord>;
  error: string | null;
  run: (options?: RunGenerateOptions) => Promise<void>;
  loadForProject: (projectId: string) => boolean;
  setViewMode: (mode: ViewMode) => void;
  getFileDiff: (path: string) => FileDiffInfo | null;
  getFileDiffStatus: (path: string) => "added" | "modified" | "unchanged" | null;
  getDiffSummary: () => DiffSummary;
  selectFile: (projectId: string, path: string) => void;
  markExported: (projectId: string, revision: number, path: string) => void;
  reset: () => void;
  downloadZip: () => Promise<void>;
}

let runToken = 0;

export const useGenerateStore = create<GenerateStore>()((set, get) => ({
  status: "idle",
  projectId: null,
  revision: null,
  projectSnapshot: null,
  result: null,
  previousResult: null,
  viewMode: "code",
  formatting: false,
  selectedByProject: {},
  exportedByProject: {},
  error: null,

  run: async (options?: RunGenerateOptions) => {
    const project = useProjectStore.getState().project;
    if (!project) return;
    if (get().status === "running") return;

    const token = ++runToken;
    const revision = useProjectStore.getState().revision;
    const currentResult = get().result;
    const currentProjectId = get().projectId;
    // Retain previous result if regenerating the same project
    const previousResult = currentProjectId === project.id ? currentResult : null;

    set({
      status: "running",
      projectId: project.id,
      revision,
      projectSnapshot: project,
      previousResult,
      formatting: false,
      error: null,
    });

    const applyResult = (result: GenerateResult): void => {
      const errors = result.issues.filter((issue) => issue.severity === "error");
      const selected = get().selectedByProject[project.id];
      const selectedExists = result.files.some((file) => file.path === selected);
      const nextSelected = selectedExists ? selected : result.files[0]?.path;

      set((state) => ({
        status: errors.length > 0 || result.files.length === 0 ? "error" : "ready",
        projectId: project.id,
        revision,
        result,
        error:
          errors.length > 0 || result.files.length === 0
            ? (errors[0]?.message ?? "No files were generated.")
            : null,
        selectedByProject:
          nextSelected === undefined
            ? state.selectedByProject
            : { ...state.selectedByProject, [project.id]: nextSelected },
      }));

      saveGeneration({
        projectId: project.id,
        revision,
        projectSnapshot: project,
        result,
        previousResult,
        selectedPath: nextSelected,
        exportRecord: get().exportedByProject[project.id],
      });
    };

    try {
      const preview = await generateProject(project, { format: false });
      if (token !== runToken) return;

      applyResult(preview);
      const errors = preview.issues.filter((issue) => issue.severity === "error");
      if (errors.length > 0 || preview.files.length === 0) {
        if (!options?.silent) {
          useUiStore.getState().pushToast({
            kind: "error",
            title: "Could not generate the project",
            message: errors[0]?.message ?? "No files were generated.",
            detail: errors.map((issue) => `${issue.code}: ${issue.message}`).join("\n"),
          });
        }
        return;
      }

      set({ formatting: true });
      if (!options?.silent) {
        useUiStore.getState().pushToast({
          kind: "success",
          title: "Preview ready",
          message: `${preview.stats.fileCount} files generated; formatting in the background.`,
        });
      }

      try {
        const formatted = await generateProject(project, { format: true });
        if (token !== runToken) return;
        if (useProjectStore.getState().revision !== revision) {
          set({ formatting: false });
          return;
        }
        applyResult(formatted);
        set({ formatting: false });
      } catch (formatError) {
        if (token !== runToken) return;
        set({ formatting: false });
        if (!options?.silent) {
          useUiStore.getState().pushToast({
            kind: "warning",
            title: "Preview is unformatted",
            message: "Formatting failed; export will use the unformatted preview.",
            detail: errorMessage(formatError),
          });
        }
      }
    } catch (error) {
      if (token !== runToken) return;
      const message = errorMessage(error);
      set({
        status: "error",
        projectId: project.id,
        revision,
        projectSnapshot: null,
        result: null,
        formatting: false,
        error: message,
      });
      if (!options?.silent) {
        useUiStore.getState().pushToast({
          kind: "error",
          title: "Generation failed",
          message,
          detail: message,
        });
      }
    }
  },

  loadForProject: (projectId: string) => {
    if (get().status === "running" && get().projectId === projectId) {
      return false;
    }
    const cached = loadGeneration(projectId);
    if (cached && cached.result) {
      set((state) => ({
        status: "ready",
        projectId: cached.projectId,
        revision: cached.revision,
        projectSnapshot: cached.projectSnapshot,
        result: cached.result,
        previousResult: cached.previousResult,
        selectedByProject: cached.selectedPath
          ? { ...state.selectedByProject, [projectId]: cached.selectedPath }
          : state.selectedByProject,
        exportedByProject: cached.exportRecord
          ? { ...state.exportedByProject, [projectId]: cached.exportRecord }
          : state.exportedByProject,
        formatting: false,
        error: null,
      }));
      return true;
    }
    if (get().projectId !== projectId) {
      set({
        status: "idle",
        projectId,
        revision: null,
        projectSnapshot: null,
        result: null,
        previousResult: null,
        formatting: false,
        error: null,
      });
    }
    return false;
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  getFileDiff: (path) => {
    const { result, previousResult } = get();
    return computeFileDiff(path, result, previousResult);
  },

  getFileDiffStatus: (path) => {
    const { result, previousResult } = get();
    return computeFileDiffStatus(path, result, previousResult);
  },

  getDiffSummary: () => {
    const { result, previousResult } = get();
    return computeDiffSummary(result, previousResult);
  },

  selectFile: (projectId, path) => {
    set((state) => ({
      selectedByProject: { ...state.selectedByProject, [projectId]: path },
    }));
    const cached = loadGeneration(projectId);
    if (cached) {
      saveGeneration({
        ...cached,
        selectedPath: path,
      });
    }
  },

  markExported: (projectId, revision, path) => {
    set((state) => ({
      exportedByProject: { ...state.exportedByProject, [projectId]: { revision, path } },
    }));
    const cached = loadGeneration(projectId);
    if (cached) {
      saveGeneration({
        ...cached,
        exportRecord: { revision, path },
      });
    }
  },

  reset: () => {
    runToken += 1;
    set({
      status: "idle",
      projectId: null,
      revision: null,
      projectSnapshot: null,
      result: null,
      previousResult: null,
      viewMode: "code",
      formatting: false,
      exportedByProject: {},
      error: null,
    });
  },

  downloadZip: async () => {
    const project = get().projectSnapshot;
    const result = get().result;
    if (!project || !result || result.files.length === 0) return;

    const { zip, fileName } = await createProjectZip(project, result.files);
    const buffer = new ArrayBuffer(zip.byteLength);
    new Uint8Array(buffer).set(zip);
    const blob = new Blob([buffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
}));

useProjectStore.subscribe((state, prevState) => {
  if (state.project?.id !== prevState.project?.id) {
    if (state.project) {
      useGenerateStore.getState().loadForProject(state.project.id);
    } else {
      useGenerateStore.getState().reset();
    }
  }
});

const activeProject = useProjectStore.getState().project;
if (activeProject) {
  useGenerateStore.getState().loadForProject(activeProject.id);
}

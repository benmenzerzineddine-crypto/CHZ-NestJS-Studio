import { create } from "zustand";
import { createProjectZip } from "@/core/export/zip";
import { generateProject, type GenerateResult } from "@/core/generate";
import type { Project } from "@/core/model/schema";
import { errorMessage } from "@/lib/tauri";
import { useProjectStore } from "./project.store";
import { useUiStore } from "./ui.store";

export type GenerateStatus = "idle" | "running" | "ready" | "error";

export interface ExportRecord {
  revision: number;
  path: string;
}

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
  run: () => Promise<void>;
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

  run: async () => {
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
    };

    try {
      const preview = await generateProject(project, { format: false });
      if (token !== runToken) return;

      applyResult(preview);
      const errors = preview.issues.filter((issue) => issue.severity === "error");
      if (errors.length > 0 || preview.files.length === 0) {
        useUiStore.getState().pushToast({
          kind: "error",
          title: "Could not generate the project",
          message: errors[0]?.message ?? "No files were generated.",
          detail: errors.map((issue) => `${issue.code}: ${issue.message}`).join("\n"),
        });
        return;
      }

      set({ formatting: true });
      useUiStore.getState().pushToast({
        kind: "success",
        title: "Preview ready",
        message: `${preview.stats.fileCount} files generated; formatting in the background.`,
      });

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
        useUiStore.getState().pushToast({
          kind: "warning",
          title: "Preview is unformatted",
          message: "Formatting failed; export will use the unformatted preview.",
          detail: errorMessage(formatError),
        });
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
      useUiStore.getState().pushToast({
        kind: "error",
        title: "Generation failed",
        message,
        detail: message,
      });
    }
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  getFileDiff: (path) => {
    const { result, previousResult } = get();
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
  },

  getFileDiffStatus: (path) => {
    const { result, previousResult } = get();
    if (!result || !previousResult) return null;
    const modifiedFile = result.files.find((f) => f.path === path);
    if (!modifiedFile) return null;
    const originalFile = previousResult.files.find((f) => f.path === path);
    if (!originalFile) return "added";
    return originalFile.content === modifiedFile.content ? "unchanged" : "modified";
  },

  getDiffSummary: () => {
    const { result, previousResult } = get();
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
  },

  selectFile: (projectId, path) => {
    set((state) => ({
      selectedByProject: { ...state.selectedByProject, [projectId]: path },
    }));
  },

  markExported: (projectId, revision, path) => {
    set((state) => ({
      exportedByProject: { ...state.exportedByProject, [projectId]: { revision, path } },
    }));
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

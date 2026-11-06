import { temporal } from "zundo";
import { create } from "zustand";
import { saveProject } from "@/lib/projects";
import { errorMessage } from "@/lib/tauri";
import { createAuthSettingsSlice } from "./slices/auth-settings.slice";
import { createEndpointEnumSlice } from "./slices/endpoint-enum.slice";
import { createEntitySlice } from "./slices/entity.slice";
import { createFieldSlice } from "./slices/field.slice";
import { createRelationSlice } from "./slices/relation.slice";
import type {
  ProjectStore,
  RelationInput,
  RelationPatch,
  SaveStatus,
} from "./slices/types";
import { useUiStore } from "./ui.store";

export type { ProjectStore, RelationInput, RelationPatch, SaveStatus };

export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set, get) => ({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,

      openProject: (project) => {
        set({
          project,
          status: "saved",
          revision: 0,
          lastSavedAt: new Date().toISOString(),
          error: null,
        });
        useProjectStore.temporal.getState().clear();
      },

      closeProject: async () => {
        const { project } = get();
        if (project) {
          const saved = await get().saveNow();
          if (!saved) return false;
        }

        set({ project: null, status: "idle", revision: 0, error: null });
        useProjectStore.temporal.getState().clear();
        return true;
      },

      updateProject: (mutator) => {
        set((state) => {
          if (!state.project) return state;

          const draft = structuredClone(state.project);
          mutator(draft);
          draft.updatedAt = new Date().toISOString();

          return {
            project: draft,
            status: "dirty",
            revision: state.revision + 1,
            error: null,
          };
        });
      },

      saveNow: async () => {
        const { project, status, revision } = get();
        if (!project) return true;
        if (status === "saving" || status === "saved") return true;

        set({ status: "saving", error: null });

        try {
          await saveProject(project);
          const current = get();
          if (current.revision === revision) {
            set({ status: "saved", lastSavedAt: new Date().toISOString() });
          } else {
            set({ status: "dirty" });
          }
          return true;
        } catch (error) {
          const message = errorMessage(error);
          set({ status: "error", error: message });
          useUiStore.getState().pushToast({
            kind: "error",
            title: "Could not save project",
            message,
            detail: message,
          });
          return false;
        }
      },

      setLastExportPath: (path) => {
        set((state) => {
          if (!state.project || state.project.lastExportPath === path) return state;

          const draft = structuredClone(state.project);
          draft.lastExportPath = path;
          draft.updatedAt = new Date().toISOString();

          return {
            project: draft,
            status: "dirty",
            error: null,
          };
        });
      },

      ...createEntitySlice(get),
      ...createFieldSlice(get),
      ...createRelationSlice(get),
      ...createEndpointEnumSlice(get),
      ...createAuthSettingsSlice(get),
    }),
    {
      limit: 100,
      partialize: (state) => ({ project: state.project }),
      equality: (past, current) => past.project === current.project,
    },
  ),
);

function markHistoryChange(): void {
  const state = useProjectStore.getState();
  if (!state.project) return;

  useProjectStore.setState({
    status: "dirty",
    revision: state.revision + 1,
    error: null,
  });
}

export function undoProject(): void {
  const temporalStore = useProjectStore.temporal.getState();
  if (temporalStore.pastStates.length === 0) return;

  temporalStore.undo();
  markHistoryChange();
}

export function redoProject(): void {
  const temporalStore = useProjectStore.temporal.getState();
  if (temporalStore.futureStates.length === 0) return;

  temporalStore.redo();
  markHistoryChange();
}

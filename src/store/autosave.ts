import { useEffect } from "react";
import { useProjectStore } from "./project.store";

/**
 * Debounced persistence for model edits. Undo/redo bumps the revision and
 * therefore schedules a save too.
 */
export function useAutosave(): void {
  const project = useProjectStore((state) => state.project);
  const revision = useProjectStore((state) => state.revision);

  useEffect(() => {
    if (!project) return;

    const status = useProjectStore.getState().status;
    if (status !== "dirty" && status !== "error") return;

    const timer = window.setTimeout(() => {
      void useProjectStore.getState().saveNow();
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [project, revision]);
}

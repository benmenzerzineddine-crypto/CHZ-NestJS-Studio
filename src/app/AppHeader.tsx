import { BookOpen, Boxes, Redo2, ShieldCheck, Undo2 } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { countIssues, validateProject } from "@/core/validate/validate";
import { useUiStore } from "@/store/ui.store";
import {
  redoProject,
  undoProject,
  useProjectStore,
  type SaveStatus,
} from "@/store/project.store";

const STATUS: Record<SaveStatus, { label: string; dot: string }> = {
  idle: { label: "", dot: "bg-transparent" },
  saved: { label: "Saved", dot: "bg-success" },
  saving: { label: "Saving…", dot: "animate-pulse bg-warning" },
  dirty: { label: "Unsaved", dot: "bg-warning" },
  error: { label: "Save failed", dot: "bg-danger" },
};

export function AppHeader() {
  const project = useProjectStore((state) => state.project);
  const status = useProjectStore((state) => state.status);
  const canUndo = useStore(
    useProjectStore.temporal,
    (state) => state.pastStates.length > 0,
  );
  const canRedo = useStore(
    useProjectStore.temporal,
    (state) => state.futureStates.length > 0,
  );
  const setValidationOpen = useUiStore((state) => state.setValidationOpen);
  const setScreen = useUiStore((state) => state.setScreen);
  const issues = useMemo(
    () => (project ? validateProject(project) : []),
    [project],
  );
  const counts = countIssues(issues);

  const tone = STATUS[status];
  const validationTone =
    counts.errors > 0
      ? "border-danger/30 bg-danger/10 text-danger"
      : counts.warnings > 0
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-success/30 bg-success/10 text-success";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
          <Boxes className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-foreground">chz-nest</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
            NestJS API studio
          </p>
        </div>
      </div>

      {project ? (
        <>
          <div className="mx-2 h-6 w-px bg-border" />
          <p className="min-w-0 flex-1 truncate text-sm text-muted">{project.name}</p>

          <button
            type="button"
            onClick={() => setValidationOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
              validationTone,
            )}
            aria-label="Open model checks"
          >
            <ShieldCheck className="h-3 w-3" />
            {counts.errors > 0
              ? `${counts.errors} ${counts.errors === 1 ? "error" : "errors"}`
              : counts.warnings > 0
                ? `${counts.warnings} ${counts.warnings === 1 ? "warning" : "warnings"}`
                : "Valid"}
          </button>

          <div className="flex items-center gap-1">
            <span className="mr-2 flex items-center gap-1.5 text-xs text-muted">
              <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              {tone.label}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undoProject}
                  disabled={!canUndo}
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo · Ctrl/Cmd+Z</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={redoProject}
                  disabled={!canRedo}
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo · Ctrl/Cmd+Shift+Z</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setScreen("documentation")}
                  aria-label="Documentation"
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Documentation</TooltipContent>
            </Tooltip>
          </div>
        </>
      ) : (
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScreen("documentation")}
            className="h-8 gap-1.5 text-xs text-muted hover:text-foreground"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Documentation
          </Button>
          <span className="text-xs text-muted">Local workspace</span>
        </div>
      )}
    </header>
  );
}

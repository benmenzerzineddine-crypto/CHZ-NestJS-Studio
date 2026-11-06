import { FolderOpen, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DRIVER_LABELS } from "@/lib/drivers";
import type { ProjectSummary } from "@/lib/projects";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface ProjectCardProps {
  project: ProjectSummary;
  busy: boolean;
  onOpen: (project: ProjectSummary) => void;
  onDeleteRequest: (project: ProjectSummary) => void;
}

export function ProjectCard({
  project,
  busy,
  onOpen,
  onDeleteRequest,
}: ProjectCardProps) {
  return (
    <div className="group relative rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={() => onOpen(project)}
        disabled={busy}
        className="flex h-full w-full flex-col items-start gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted" />
            ) : (
              <FolderOpen className="h-4 w-4 text-accent" />
            )}
          </div>
          <Badge>{DRIVER_LABELS[project.driver] ?? project.driver}</Badge>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {project.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {project.entityCount}{" "}
            {project.entityCount === 1 ? "entity" : "entities"}
          </p>
        </div>

        <p className="mt-auto pt-2 text-[11px] text-muted/80">
          Updated {formatDate(project.updatedAt)}
        </p>
      </button>

      <button
        type="button"
        onClick={() => onDeleteRequest(project)}
        className="absolute right-3 top-14 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-surface-hover hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100"
        aria-label={`Delete ${project.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

import {
  BookOpen,
  Boxes,
  FolderOpen,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createProject } from "@/core/model/defaults";
import type { Project } from "@/core/model/schema";
import { DRIVER_LABELS } from "@/lib/drivers";
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
  type ProjectSummary,
} from "@/lib/projects";
import { errorMessage } from "@/lib/tauri";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { ImportProjectDialog } from "./ImportProjectDialog";
import { NewProjectDialog, type NewProjectInput } from "./NewProjectDialog";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProjectsScreen() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openProject = useProjectStore((state) => state.openProject);
  const setScreen = useUiStore((state) => state.setScreen);
  const pushToast = useUiStore((state) => state.pushToast);

  async function handleImportProject(imported: Project) {
    try {
      await saveProject(imported);
      openProject(imported);
      setScreen("settings");
      pushToast({
        kind: "success",
        title: "Project imported",
        message: `Imported "${imported.name}" with ${imported.entities.length} entities.`,
      });
    } catch (error) {
      pushToast({
        kind: "error",
        title: "Could not import project",
        message: errorMessage(error),
        detail: errorMessage(error),
      });
      throw error;
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (error) {
      pushToast({
        kind: "error",
        title: "Could not load projects",
        message: errorMessage(error),
        detail: errorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleOpen(summary: ProjectSummary) {
    setBusyId(summary.id);
    try {
      const project = await loadProject(summary.id);
      openProject(project);
      setScreen("settings");
    } catch (error) {
      pushToast({
        kind: "error",
        title: `Could not open "${summary.name}"`,
        message: errorMessage(error),
        detail: errorMessage(error),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(input: NewProjectInput) {
    const project = createProject(input.name, input.driver, input.authEnabled);
    await saveProject(project);
    openProject(project);
    setScreen("settings");
    pushToast({
      kind: "success",
      title: "Project created",
      message: `${project.name} is ready to model.`,
    });
  }

  async function handleDelete() {
    if (!pendingDelete) return;

    try {
      await deleteProject(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
      pushToast({ kind: "success", title: "Project deleted" });
    } catch (error) {
      pushToast({
        kind: "error",
        title: "Could not delete project",
        message: errorMessage(error),
        detail: errorMessage(error),
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted">
            Model your data once, then generate and export a NestJS API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setScreen("documentation")}>
            <BookOpen className="h-4 w-4" />
            Documentation
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Import schema
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-20 text-center">
          <div className="mb-4 rounded-full border border-border bg-surface-raised p-3">
            <Boxes className="h-6 w-6 text-muted" />
          </div>
          <h2 className="text-base font-medium text-foreground">No projects yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Start with a data model. Authentication, CRUD endpoints and the full
            NestJS project are generated from it.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Import schema
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create your first project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const busy = busyId === project.id;
            return (
              <div
                key={project.id}
                className="group relative rounded-xl border border-border bg-surface transition-colors hover:border-border-strong"
              >
                <button
                  type="button"
                  onClick={() => void handleOpen(project)}
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
                  onClick={() => setPendingDelete(project)}
                  className="absolute right-3 top-14 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-surface-hover hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:opacity-100"
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NewProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" will be removed from this device. Generated code already exported is not affected.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()}>
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProjectDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImportProject}
      />
    </div>
  );
}

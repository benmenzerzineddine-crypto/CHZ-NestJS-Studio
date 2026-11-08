import {
  BookOpen,
  LayoutTemplate,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createProject } from "@/core/model/defaults";
import type { Project } from "@/core/model/schema";
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
  type ProjectSummary,
} from "@/lib/projects";
import { errorMessage } from "@/lib/tauri";
import { clearGeneration, useGenerateStore } from "@/store/generate.store";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { ImportProjectDialog } from "./ImportProjectDialog";
import { NewProjectDialog, type NewProjectInput } from "./NewProjectDialog";
import { ProjectCard } from "./ProjectCard";
import { EmptyProjectsState } from "./EmptyProjectsState";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { TemplatesGalleryDialog } from "./TemplatesGalleryDialog";

export function ProjectsScreen() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openProject = useProjectStore((state) => state.openProject);
  const setScreen = useUiStore((state) => state.setScreen);
  const pushToast = useUiStore((state) => state.pushToast);

  async function handleImportProject(imported: Project) {
    try {
      await saveProject(imported);
      openProject(imported);
      void useGenerateStore.getState().run({ silent: true });
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
      if (!useGenerateStore.getState().result) {
        void useGenerateStore.getState().run({ silent: true });
      }
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
    void useGenerateStore.getState().run({ silent: true });
    setScreen("settings");
    pushToast({
      kind: "success",
      title: "Project created",
      message: `${project.name} is ready to model.`,
    });
  }

  async function handleCreateFromTemplate(project: Project) {
    try {
      await saveProject(project);
      openProject(project);
      void useGenerateStore.getState().run({ silent: true });
      setScreen("settings");
      pushToast({
        kind: "success",
        title: "Project created from template",
        message: `${project.name} is ready with pre-configured models and endpoints.`,
      });
    } catch (error) {
      pushToast({
        kind: "error",
        title: "Could not create project from template",
        message: errorMessage(error),
        detail: errorMessage(error),
      });
      throw error;
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;

    try {
      await deleteProject(pendingDelete.id);
      clearGeneration(pendingDelete.id);
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
          <Button variant="secondary" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="h-4 w-4" />
            Templates
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
        <EmptyProjectsState
          onImportClick={() => setImportOpen(true)}
          onCreateClick={() => setCreateOpen(true)}
          onTemplatesClick={() => setTemplatesOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              busy={busyId === project.id}
              onOpen={handleOpen}
              onDeleteRequest={setPendingDelete}
            />
          ))}
        </div>
      )}

      <NewProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        onOpenTemplates={() => setTemplatesOpen(true)}
      />

      <DeleteProjectDialog
        pendingDelete={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />

      <ImportProjectDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImportProject}
      />

      <TemplatesGalleryDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelectTemplate={handleCreateFromTemplate}
      />
    </div>
  );
}

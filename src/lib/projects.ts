import { z } from "zod";
import type { Driver, Project } from "@/core/model/schema";
import { migrateProject } from "@/core/model/schema";
import { AppError, invokeCommand, isTauriRuntime } from "./tauri";

export interface ProjectSummary {
  id: string;
  name: string;
  driver: Driver;
  entityCount: number;
  updatedAt: string;
}

const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  driver: z.enum(["postgres", "mysql", "sqlite"]),
  entityCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

const projectSummaryListSchema = z.array(projectSummarySchema);

const LOCAL_STORAGE_KEY = "chz-nest:projects";

type LocalProjects = Record<string, Project>;

function readLocal(): LocalProjects {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const projects: LocalProjects = {};
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      try {
        const project = migrateProject(value);
        projects[project.id] = project;
      } catch {
        // Skip corrupt entries instead of losing every project.
      }
    }
    return projects;
  } catch {
    return {};
  }
}

function writeLocal(projects: LocalProjects): void {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
}

export function summarizeProject(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    driver: project.driver,
    entityCount: project.entities.length,
    updatedAt: project.updatedAt,
  };
}

export async function saveProject(project: Project): Promise<void> {
  if (isTauriRuntime()) {
    await invokeCommand<void>("save_project", { project });
    return;
  }

  const projects = readLocal();
  projects[project.id] = project;
  writeLocal(projects);
}

export async function loadProject(id: string): Promise<Project> {
  if (isTauriRuntime()) {
    return migrateProject(await invokeCommand<unknown>("load_project", { id }));
  }

  const project = readLocal()[id];
  if (!project) throw new AppError("Project not found");
  return project;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (isTauriRuntime()) {
    const raw = await invokeCommand<unknown>("list_projects");
    return projectSummaryListSchema.parse(raw);
  }

  return Object.values(readLocal())
    .map(summarizeProject)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invokeCommand<void>("delete_project", { id });
    return;
  }

  const projects = readLocal();
  delete projects[id];
  writeLocal(projects);
}

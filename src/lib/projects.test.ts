import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "@/core/model/defaults";
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from "./projects";

describe("project repository (browser fallback)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves, lists, loads and deletes projects", async () => {
    const project = createProject("Blog API");

    await saveProject(project);
    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: project.id,
      name: "Blog API",
      driver: "postgres",
      entityCount: 1,
    });

    const loaded = await loadProject(project.id);
    expect(loaded.packageName).toBe("blog-api");

    await deleteProject(project.id);
    expect(await listProjects()).toHaveLength(0);
    await expect(loadProject(project.id)).rejects.toThrow("Project not found");
  });

  it("sorts projects by most recently updated", async () => {
    const first = createProject("First");
    const second = { ...createProject("Second"), updatedAt: "2030-01-01T00:00:00.000Z" };

    await saveProject(first);
    await saveProject(second);

    const projects = await listProjects();
    expect(projects.map((project) => project.name)).toEqual(["Second", "First"]);
  });

  it("ignores corrupt local project entries", async () => {
    const project = createProject("Valid");
    await saveProject(project);

    const raw = window.localStorage.getItem("chz-nest:projects");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    stored["prj_corrupt"] = { id: "prj_corrupt", schemaVersion: 1 };
    window.localStorage.setItem("chz-nest:projects", JSON.stringify(stored));

    const projects = await listProjects();
    expect(projects.map((entry) => entry.id)).toEqual([project.id]);
    await expect(loadProject("prj_corrupt")).rejects.toThrow("Project not found");
  });
});

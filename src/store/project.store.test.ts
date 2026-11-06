import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "@/core/model/defaults";
import { redoProject, undoProject, useProjectStore } from "./project.store";

function resetStore(): void {
  useProjectStore.setState({
    project: null,
    status: "idle",
    revision: 0,
    lastSavedAt: null,
    error: null,
  });
  useProjectStore.temporal.getState().clear();
  window.localStorage.clear();
}

describe("project store", () => {
  beforeEach(resetStore);

  it("opens a project as saved and clears history", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    const state = useProjectStore.getState();
    expect(state.status).toBe("saved");
    expect(state.project?.id).toBe(project.id);
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it("marks the project dirty and tracks revisions on edit", () => {
    useProjectStore.getState().openProject(createProject("Blog API"));
    useProjectStore.getState().updateProject((draft) => {
      draft.name = "Renamed API";
    });

    const state = useProjectStore.getState();
    expect(state.project?.name).toBe("Renamed API");
    expect(state.status).toBe("dirty");
    expect(state.revision).toBe(1);
  });

  it("undoes and redoes model changes, marking the project dirty", () => {
    useProjectStore.getState().openProject(createProject("Blog API"));
    useProjectStore.getState().updateProject((draft) => {
      draft.name = "Renamed API";
    });

    undoProject();
    expect(useProjectStore.getState().project?.name).toBe("Blog API");
    expect(useProjectStore.getState().status).toBe("dirty");

    redoProject();
    expect(useProjectStore.getState().project?.name).toBe("Renamed API");
  });

  it("ignores undo when there is no history", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    undoProject();
    expect(useProjectStore.getState().project?.name).toBe(project.name);
  });

  it("saves through the local fallback and clears dirty", async () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);
    useProjectStore.getState().updateProject((draft) => {
      draft.name = "Renamed API";
    });

    const saved = await useProjectStore.getState().saveNow();
    expect(saved).toBe(true);
    expect(useProjectStore.getState().status).toBe("saved");

    const raw = window.localStorage.getItem("chz-nest:projects");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "{}") as Record<string, { name: string }>;
    expect(stored[project.id]?.name).toBe("Renamed API");
  });

  it("stores the last export path without invalidating the model revision", async () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);
    useProjectStore.getState().setLastExportPath("/tmp/blog-api");

    const state = useProjectStore.getState();
    expect(state.project?.lastExportPath).toBe("/tmp/blog-api");
    expect(state.status).toBe("dirty");
    expect(state.revision).toBe(0);

    const saved = await state.saveNow();
    expect(saved).toBe(true);
  });

  it("closes a project after flushing pending changes", async () => {
    useProjectStore.getState().openProject(createProject("Blog API"));
    useProjectStore.getState().updateProject((draft) => {
      draft.name = "Renamed API";
    });

    const closed = await useProjectStore.getState().closeProject();
    expect(closed).toBe(true);
    expect(useProjectStore.getState().project).toBeNull();
    expect(useProjectStore.getState().status).toBe("idle");
  });

  it("adds, updates, and deletes custom endpoints", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);
    const entityId = project.entities[0].id;

    const epId = useProjectStore.getState().addCustomEndpoint(entityId, {
      id: "ep_test123",
      name: "publish",
      method: "POST",
      path: "/publish",
      access: { level: "authenticated" },
    });
    expect(epId).toBe("ep_test123");

    let entity = useProjectStore.getState().project?.entities.find((e) => e.id === entityId);
    expect(entity?.customEndpoints).toHaveLength(1);
    expect(entity?.customEndpoints[0].name).toBe("publish");

    useProjectStore.getState().updateCustomEndpoint(entityId, "ep_test123", {
      name: "publishNow",
      path: "/publish-now",
    });
    entity = useProjectStore.getState().project?.entities.find((e) => e.id === entityId);
    expect(entity?.customEndpoints[0].name).toBe("publishNow");
    expect(entity?.customEndpoints[0].path).toBe("/publish-now");

    useProjectStore.getState().deleteCustomEndpoint(entityId, "ep_test123");
    entity = useProjectStore.getState().project?.entities.find((e) => e.id === entityId);
    expect(entity?.customEndpoints).toHaveLength(0);
  });

  it("updates upload settings", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    expect(useProjectStore.getState().project?.settings.uploads.enabled).toBe(false);

    useProjectStore.getState().updateUploadSettings({
      enabled: true,
      driver: "s3",
      maxFileSizeMb: 50,
    });

    const uploads = useProjectStore.getState().project?.settings.uploads;
    expect(uploads?.enabled).toBe(true);
    expect(uploads?.driver).toBe("s3");
    expect(uploads?.maxFileSizeMb).toBe(50);
  });

  it("updates multitenancy settings", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    expect(useProjectStore.getState().project?.settings.multitenancy.enabled).toBe(false);

    useProjectStore.getState().updateMultitenancySettings({
      enabled: true,
      header: "x-workspace-id",
    });

    const multitenancy = useProjectStore.getState().project?.settings.multitenancy;
    expect(multitenancy?.enabled).toBe(true);
    expect(multitenancy?.header).toBe("x-workspace-id");
  });

  it("updates throttling settings", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    expect(useProjectStore.getState().project?.settings.throttling.enabled).toBe(true);
    expect(useProjectStore.getState().project?.settings.throttling.limit).toBe(100);

    useProjectStore.getState().updateThrottlingSettings({
      enabled: false,
      limit: 250,
      ttl: 120,
    });

    const throttling = useProjectStore.getState().project?.settings.throttling;
    expect(throttling?.enabled).toBe(false);
    expect(throttling?.limit).toBe(250);
    expect(throttling?.ttl).toBe(120);
  });
});

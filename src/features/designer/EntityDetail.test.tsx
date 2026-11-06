import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createEntity, createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { EntityDetail } from "./EntityDetail";

describe("EntityDetail", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
  });

  it("toggles multitenant option on non-system entity", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<EntityDetail entity={post} />);

    const toggle = screen.getByLabelText("Multi-tenant");
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    const updated = useProjectStore.getState().project?.entities.find((e) => e.id === post.id);
    expect(updated?.options.multitenant).toBe(true);
  });

  it("toggles entity options and performance overrides", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<EntityDetail entity={post} />);

    // Toggle soft delete
    const softDeleteToggle = screen.getByLabelText("Soft delete");
    expect(softDeleteToggle).not.toBeChecked();
    fireEvent.click(softDeleteToggle);

    let updated = useProjectStore.getState().project?.entities.find((e) => e.id === post.id);
    expect(updated?.options.softDelete).toBe(true);

    // Toggle rate limit override
    const throttleToggle = screen.getByLabelText("Rate Limit Override");
    expect(throttleToggle).not.toBeChecked();
    fireEvent.click(throttleToggle);

    updated = useProjectStore.getState().project?.entities.find((e) => e.id === post.id);
    expect(updated?.options.throttle).toEqual({ limit: 20, ttl: 60 });

    // Toggle cache hints
    const cacheToggle = screen.getByLabelText("Response Cache Hints");
    expect(cacheToggle).not.toBeChecked();
    fireEvent.click(cacheToggle);

    updated = useProjectStore.getState().project?.entities.find((e) => e.id === post.id);
    expect(updated?.options.cache).toEqual({ maxAge: 60, scope: "public" });
  });
});

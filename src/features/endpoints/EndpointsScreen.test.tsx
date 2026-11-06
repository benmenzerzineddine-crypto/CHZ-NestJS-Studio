import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createEntity, createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { EndpointsScreen } from "./EndpointsScreen";

describe("EndpointsScreen", () => {
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

  it("renders standard endpoints when uploads disabled", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    render(<EndpointsScreen />);
    expect(screen.getByText("/api/health")).toBeInTheDocument();
    expect(screen.queryByText("/api/attachments/upload")).not.toBeInTheDocument();
  });

  it("renders attachment endpoints when uploads enabled", () => {
    const project = createProject("Blog API");
    project.settings.uploads = {
      enabled: true,
      driver: "local",
      maxFileSizeMb: 10,
    };
    useProjectStore.getState().openProject(project);

    render(<EndpointsScreen />);
    expect(screen.getByText("/api/health")).toBeInTheDocument();
    expect(screen.getByText("/api/attachments/upload")).toBeInTheDocument();
    expect(screen.getByText("/api/attachments/:id/download")).toBeInTheDocument();
  });

  it("renders multi-tenant badge on entity when enabled", () => {
    const project = createProject("Blog API");
    project.settings.multitenancy = {
      enabled: true,
      header: "x-tenant-id",
    };
    const post = createEntity("Post");
    post.options.multitenant = true;
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<EndpointsScreen />);
    expect(screen.getByText("Multi-tenant (x-tenant-id)")).toBeInTheDocument();
  });

  it("renders rate limit and cache badges on entity endpoints", () => {
    const project = createProject("Blog API");
    const post = createEntity("Post");
    post.options.throttle = { limit: 20, ttl: 60 };
    post.options.cache = { maxAge: 120, scope: "public" };
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<EndpointsScreen />);
    expect(screen.getAllByText("Rate: 20/60s").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cache: 120s (public)").length).toBeGreaterThan(0);
  });

  it("filters entities by search query and hides system routes when query active", () => {
    const project = createProject("Blog API");
    const post = createEntity("Post");
    const author = createEntity("Author");
    project.entities.push(post, author);
    useProjectStore.getState().openProject(project);

    render(<EndpointsScreen />);
    expect(screen.getByText("Auth & system")).toBeInTheDocument();
    expect(screen.getByText("Post")).toBeInTheDocument();
    expect(screen.getByText("Author")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Filter by entity…");
    fireEvent.change(searchInput, { target: { value: "post" } });

    expect(screen.queryByText("Auth & system")).not.toBeInTheDocument();
    expect(screen.getByText("Post")).toBeInTheDocument();
    expect(screen.queryByText("Author")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    expect(screen.getByText("No entities match that filter.")).toBeInTheDocument();
  });
});


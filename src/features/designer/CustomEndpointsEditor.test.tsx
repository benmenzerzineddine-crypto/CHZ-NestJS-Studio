import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/app/App";
import { createEntity, createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

function setupFixture() {
  window.localStorage.clear();
  const project = createProject("Test API");
  const post = createEntity("Post");
  project.entities.push(post);

  useProjectStore.setState({
    project: null,
    status: "idle",
    revision: 0,
    lastSavedAt: null,
    error: null,
  });
  useProjectStore.temporal.getState().clear();
  useProjectStore.getState().openProject(project);

  useUiStore.setState({
    screen: "entities",
    designerTab: "entities",
    selectedEntityId: post.id,
    selectedFieldId: null,
    selectedEnumId: null,
    toasts: [],
  });
}

describe("CustomEndpointsEditor", () => {
  beforeEach(setupFixture);

  it("renders the custom endpoints section", () => {
    render(<App />);
    expect(screen.getByText("Custom Endpoints")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add endpoint/i })).toBeInTheDocument();
  });

  it("adds a custom endpoint through the dialog", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Add endpoint/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const pathInput = within(dialog).getByPlaceholderText("/publish or :id/archive");
    fireEvent.change(pathInput, { target: { value: "/publish" } });

    // Submit
    fireEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));

    // Verify it appears in the list
    expect(screen.getByText("/publish")).toBeInTheDocument();
    expect(screen.getByText("→ publish()")).toBeInTheDocument();
  });

  it("displays custom endpoints in EndpointsScreen with Custom badge", () => {
    const post = useProjectStore.getState().project?.entities.find((e) => e.name === "Post")!;
    useProjectStore.getState().addCustomEndpoint(post.id, {
      id: "ep_pub",
      name: "publish",
      method: "POST",
      path: "/publish",
      access: { level: "authenticated" },
    });

    act(() => {
      useUiStore.getState().setScreen("endpoints");
    });

    render(<App />);

    expect(screen.getByText("/api/posts/publish")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("configures custom throttle and cache-control settings on GET endpoint", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Add endpoint/i }));
    const dialog = screen.getByRole("dialog");

    // Path
    const pathInput = within(dialog).getByPlaceholderText("/publish or :id/archive");
    fireEvent.change(pathInput, { target: { value: "/feed" } });

    // Method is GET by default; enable cache header
    const enableCacheCheck = within(dialog).getByLabelText("Enable cache header");
    fireEvent.click(enableCacheCheck);

    // Rate limiting: switch to custom
    const throttleSelect = within(dialog).getAllByRole("combobox")[2];
    fireEvent.change(throttleSelect, { target: { value: "custom" } });

    // Submit
    fireEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));

    const post = useProjectStore.getState().project?.entities.find((e) => e.name === "Post")!;
    const ep = post.customEndpoints?.find((e) => e.name === "feed");
    expect(ep).toBeDefined();
    expect(ep?.method).toBe("GET");
    expect(ep?.cache?.maxAge).toBe(60);
    expect(ep?.cache?.scope).toBe("public");
    expect(ep?.throttle).toEqual({ limit: 10, ttl: 60 });
  });

  it("validates empty path and invalid handler name format", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Add endpoint/i }));
    const dialog = screen.getByRole("dialog");

    // Try submit empty
    fireEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));
    expect(within(dialog).getByText("Path cannot be empty.")).toBeInTheDocument();

    // Invalid path without leading slash
    const pathInput = within(dialog).getByPlaceholderText("/publish or :id/archive");
    fireEvent.change(pathInput, { target: { value: "invalid-path" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));
    expect(
      within(dialog).getByText('Path should start with "/" (e.g. /publish or /stats) or a param (e.g. :id/archive).'),
    ).toBeInTheDocument();
  });
});


import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/app/App";
import { createEntity, createEnum, createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

function openDesignerFixture(): void {
  window.localStorage.clear();

  const project = createProject("Blog API");
  project.entities.push(createEntity("Post"));
  project.enums.push(createEnum("PostStatus", ["draft", "published"]));

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
    selectedEntityId: "ent_user",
    selectedFieldId: null,
    selectedEnumId: null,
    toasts: [],
  });
}

describe("designer screens", () => {
  beforeEach(openDesignerFixture);

  it("renders the entities workspace with the validation panel", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "User" })).toBeInTheDocument();
    expect(screen.getByText("Model checks")).toBeInTheDocument();
    expect(screen.getAllByText("email").length).toBeGreaterThan(0);
    expect(screen.getByText("Add field")).toBeInTheDocument();
  });


  it("detects duplicate field names live and reverts on blur", () => {
    const post = useProjectStore
      .getState()
      .project?.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post");

    const titleId = useProjectStore.getState().addField(post.id, "title", "string");
    useProjectStore.getState().addField(post.id, "body", "text");
    if (!titleId) throw new Error("Missing field");

    act(() => {
      useUiStore.getState().selectEntity(post.id);
      useUiStore.getState().selectField(titleId);
    });
    render(<App />);

    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "body" } });
    expect(screen.getByText("Another field already uses this name.")).toBeInTheDocument();

    fireEvent.blur(name);
    expect(screen.getByDisplayValue("title")).toBeInTheDocument();
  });

  it("creates an entity through the add dialog", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New entity" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Entity name"), {
      target: { value: "Article" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create entity" }));

    expect(screen.getByText("/api/articles")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Article")).toBeInTheDocument();
  });

  it("adds a field through the inspector dialog", () => {
    const post = useProjectStore
      .getState()
      .project?.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post");

    act(() => {
      useUiStore.getState().selectEntity(post.id);
    });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "title" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add field" }));

    expect(screen.getByText("Field details")).toBeInTheDocument();
    expect(screen.getByDisplayValue("title")).toBeInTheDocument();
  });

  it("renders the enum editor", () => {
    const enumId = useProjectStore.getState().project?.enums[0]?.id;
    if (!enumId) throw new Error("Missing enum");

    act(() => {
      useUiStore.getState().setDesignerTab("enums");
      useUiStore.getState().selectEnum(enumId);
    });

    render(<App />);

    expect(screen.getByRole("heading", { name: "Values" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("draft")).toBeInTheDocument();
    expect(screen.getByText("unused")).toBeInTheDocument();
  });

  it("prompts before enabling ownership and does nothing on cancel", () => {
    const post = useProjectStore
      .getState()
      .project?.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post");

    render(<App />);
    act(() => {
      useUiStore.getState().selectEntity(post.id);
      useUiStore.getState().setScreen("auth");
    });

    const level = () => screen.getByLabelText("Post update access level");
    fireEvent.change(level(), { target: { value: "authenticated" } });
    fireEvent.change(level(), { target: { value: "owner" } });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Enable ownership on Post?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    let stored = useProjectStore
      .getState()
      .project?.entities.find((entity) => entity.id === post.id);
    expect(stored?.options.owner).toBe(false);
    expect(level()).toHaveValue("authenticated");

    fireEvent.change(level(), { target: { value: "owner" } });
    const confirm = screen.getByRole("dialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Add owner relation" }));

    stored = useProjectStore
      .getState()
      .project?.entities.find((entity) => entity.id === post.id);
    expect(stored?.options.owner).toBe(true);
    expect(stored?.relations.filter((relation) => relation.name === "owner")).toHaveLength(1);
  });

  it("renders the auth matrix and endpoint review", () => {
    render(<App />);

    act(() => {
      useUiStore.getState().setScreen("auth");
    });

    expect(
      screen.getByRole("heading", { name: "Authentication & authorization" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Access matrix")).toBeInTheDocument();

    act(() => {
      useUiStore.getState().setScreen("endpoints");
    });

    expect(screen.getByRole("heading", { name: "Endpoints" })).toBeInTheDocument();
    expect(screen.getByText("Auth & system")).toBeInTheDocument();
    expect(screen.getAllByText("Post").length).toBeGreaterThan(0);
  });
});

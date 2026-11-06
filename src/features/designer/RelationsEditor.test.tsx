import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createEntity, createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { RelationsEditor } from "./RelationsEditor";

describe("RelationsEditor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUiStore.setState({
      selectedEntityId: null,
      selectedFieldId: null,
      selectedEnumId: null,
      toasts: [],
    });
    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
  });

  it("renders empty state when entity has no relations", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<RelationsEditor entity={post} />);

    expect(screen.getByText("No relations yet.")).toBeInTheDocument();
  });

  it("renders relations with target entity, kind badges, and inverse descriptions", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    const user = project.entities.find((e) => e.name === "User")!;
    post.relations = [
      {
        id: "rel_author",
        name: "author",
        targetEntityId: user.id,
        kind: "many-to-one",
        nullable: false,
        cascade: false,
      },
    ];
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<RelationsEditor entity={post} />);

    expect(screen.getByText("author")).toBeInTheDocument();
    expect(screen.getByText("many-to-one")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Inverse on User: posts (one-to-many)")).toBeInTheDocument();
  });

  it("renders derived inverses for inbound relations", () => {
    const project = createProject("Test API");
    const user = project.entities.find((e) => e.name === "User")!;
    const post = createEntity("Post");
    post.relations = [
      {
        id: "rel_author",
        name: "author",
        targetEntityId: user.id,
        kind: "many-to-one",
        nullable: false,
        cascade: false,
      },
    ];
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<RelationsEditor entity={user} />);

    expect(screen.getByText("Derived inverses")).toBeInTheDocument();
    expect(screen.getByText("posts")).toBeInTheDocument();
    expect(screen.getByText("one-to-many")).toBeInTheDocument();
    expect(screen.getByText("Post.author")).toBeInTheDocument();
    expect(screen.getByText("read-only")).toBeInTheDocument();
  });

  it("opens add relation dialog and adds a new relation", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    const category = createEntity("Category");
    project.entities.push(post, category);
    useProjectStore.getState().openProject(project);

    render(<RelationsEditor entity={post} />);

    fireEvent.click(screen.getByRole("button", { name: "Add relation" }));

    expect(screen.getByRole("heading", { name: "Add relation" })).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Property name");
    fireEvent.change(nameInput, { target: { value: "category" } });

    fireEvent.click(screen.getByRole("button", { name: "Add relation" }));

    const updatedPost = useProjectStore
      .getState()
      .project?.entities.find((e) => e.id === post.id);
    expect(updatedPost?.relations.some((r) => r.name === "category")).toBe(true);
  });

  it("edits an existing relation and updates name/nullable flags", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    const category = createEntity("Category");
    post.relations = [
      {
        id: "rel_cat",
        name: "category",
        targetEntityId: category.id,
        kind: "many-to-one",
        nullable: false,
        cascade: false,
      },
    ];
    project.entities.push(post, category);
    useProjectStore.getState().openProject(project);

    render(<RelationsEditor entity={post} />);

    fireEvent.click(screen.getByLabelText("Edit category"));

    expect(screen.getByRole("heading", { name: "Edit relation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Kind")).toBeDisabled();
    expect(screen.getByLabelText("Target entity")).toBeDisabled();

    // Toggle nullable
    fireEvent.click(screen.getByLabelText("Nullable"));

    // Save relation
    fireEvent.click(screen.getByRole("button", { name: "Save relation" }));

    const updatedRel = useProjectStore
      .getState()
      .project?.entities.find((e) => e.id === post.id)
      ?.relations.find((r) => r.id === "rel_cat");
    expect(updatedRel?.nullable).toBe(true);
  });

  it("locks edit and delete for access-owned relations", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    const user = project.entities.find((e) => e.name === "User")!;
    post.relations = [
      {
        id: "rel_author",
        name: "author",
        targetEntityId: user.id,
        kind: "many-to-one",
        nullable: false,
        cascade: false,
      },
    ];
    post.options.owner = true;
    post.options.ownerRelation = "author";
    project.entities.push(post);
    useProjectStore.getState().openProject(project);

    render(<RelationsEditor entity={post} />);

    expect(screen.getByText("access-owned")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit author")).toBeDisabled();
    expect(screen.getByLabelText("Delete author")).toBeDisabled();
  });

  it("deletes a relation via ConfirmDeleteDialog", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    const category = createEntity("Category");
    post.relations = [
      {
        id: "rel_cat",
        name: "category",
        targetEntityId: category.id,
        kind: "many-to-one",
        nullable: false,
        cascade: false,
      },
    ];
    project.entities.push(post, category);
    useProjectStore.getState().openProject(project);

    render(<RelationsEditor entity={post} />);

    fireEvent.click(screen.getByLabelText("Delete category"));

    expect(screen.getByRole("heading", { name: "Delete relation" })).toBeInTheDocument();
    expect(
      screen.getByText("Remove Post.category? The derived inverse disappears with it."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete relation" }));

    const updatedPost = useProjectStore
      .getState()
      .project?.entities.find((e) => e.id === post.id);
    expect(updatedPost?.relations).toHaveLength(0);
  });
});

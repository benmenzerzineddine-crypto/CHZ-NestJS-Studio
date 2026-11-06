import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createEntity, createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { AccessMatrix } from "./AccessMatrix";

describe("AccessMatrix", () => {
  beforeEach(() => {
    window.localStorage.clear();
    const project = createProject("Blog API");
    const post = createEntity("Post");
    const tag = createEntity("Tag");
    project.entities.push(post, tag);

    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
    useProjectStore.getState().openProject(project);

    useUiStore.setState({
      selectedEntityId: post.id,
      toasts: [],
    });
  });

  it("renders CRUD operation rows and entity tabs", () => {
    render(<AccessMatrix />);
    expect(screen.getByText("Access matrix")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tag" })).toBeInTheDocument();

    expect(screen.getByText("List")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("changes operation access level", () => {
    render(<AccessMatrix />);

    const listSelect = screen.getByLabelText("Post list access level");
    expect(listSelect).toHaveValue("authenticated");

    fireEvent.change(listSelect, { target: { value: "public" } });
    const post = useProjectStore.getState().project?.entities.find((e) => e.name === "Post");
    expect(post?.access.list.level).toBe("public");
  });

  it("switches to another entity via tabs", () => {
    render(<AccessMatrix />);

    const tagButton = screen.getByRole("button", { name: "Tag" });
    fireEvent.click(tagButton);

    expect(useUiStore.getState().selectedEntityId).toBe(
      useProjectStore.getState().project?.entities.find((e) => e.name === "Tag")?.id,
    );
  });

  it("renders read-only restore row when soft delete is enabled", () => {
    const post = useProjectStore.getState().project?.entities.find((e) => e.name === "Post")!;
    post.options.softDelete = true;
    useProjectStore.setState({ project: { ...useProjectStore.getState().project! } });

    render(<AccessMatrix />);
    expect(screen.getByText("Restore")).toBeInTheDocument();
    expect(screen.getByText("Read-only. The restore route follows the Delete rule.")).toBeInTheDocument();
  });
});

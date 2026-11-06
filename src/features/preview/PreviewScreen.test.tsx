import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateResult } from "@/core/generate";
import { buildFileTree } from "@/core/ir/tree";
import type { GeneratedFile } from "@/core/ir/types";
import { createProject } from "@/core/model/defaults";
import { useGenerateStore } from "@/store/generate.store";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { PreviewScreen } from "./PreviewScreen";

vi.mock("./CodeViewer", () => ({
  CodeViewer: ({ path, content }: { path: string; content: string }) => (
    <pre data-testid="code-viewer">{`${path}\n${content}`}</pre>
  ),
}));

vi.mock("./DiffViewer", () => ({
  DiffViewer: ({
    path,
    original,
    modified,
    status,
  }: {
    path: string;
    original: string | null;
    modified: string;
    status: string;
  }) => (
    <pre data-testid="diff-viewer">{`${path} [${status}]: ${original ?? "null"} -> ${modified}`}</pre>
  ),
}));

const files: GeneratedFile[] = [
  { path: "README.md", content: "# Blog\n", kind: "markdown" },
  { path: "src/main.ts", content: "export const main = true;\n", kind: "typescript" },
];

function generateResult(): GenerateResult {
  return {
    files,
    tree: buildFileTree(files, "blog-api"),
    issues: [],
    stats: { fileCount: files.length, totalBytes: 42, byKind: { typescript: 1, json: 0, config: 0, markdown: 1, env: 0, docker: 0 } },
    warnings: [],
  };
}

describe("PreviewScreen", () => {
  beforeEach(() => {
    const project = createProject("Blog API");
    window.localStorage.clear();
    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
    useProjectStore.getState().openProject(project);
    useUiStore.setState({ screen: "generate", toasts: [] });
    useGenerateStore.setState({
      status: "idle",
      projectId: null,
      revision: null,
      result: null,
      selectedByProject: {},
      exportedByProject: {},
      error: null,
    });
  });

  it("shows the empty state before the first generation", () => {
    render(<PreviewScreen />);
    expect(screen.getByText("No generated files yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate/ })).toBeInTheDocument();
  });

  it("renders the tree, stats and selected file", () => {
    const project = useProjectStore.getState().project;
    if (!project) throw new Error("Missing project");
    const result = generateResult();
    useGenerateStore.setState({
      status: "ready",
      projectId: project.id,
      revision: 0,
      result,
      selectedByProject: { [project.id]: "README.md" },
    });

    render(<PreviewScreen />);

    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(screen.getAllByText("README.md").length).toBeGreaterThan(0);
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByTestId("code-viewer")).toHaveTextContent("README.md");

    fireEvent.click(screen.getByRole("button", { name: /main\.ts/ }));
    expect(screen.getByTestId("code-viewer")).toHaveTextContent("src/main.ts");
    expect(useGenerateStore.getState().selectedByProject[project.id]).toBe("src/main.ts");
  });

  it("marks the preview as stale after the model changes", () => {
    const project = useProjectStore.getState().project;
    if (!project) throw new Error("Missing project");
    useGenerateStore.setState({
      status: "ready",
      projectId: project.id,
      revision: 0,
      result: generateResult(),
      selectedByProject: { [project.id]: "README.md" },
    });
    useProjectStore.setState({ revision: 2 });

    render(<PreviewScreen />);
    expect(screen.getByText("Model changed")).toBeInTheDocument();
    expect(screen.getByText(/Regenerate to refresh/)).toBeInTheDocument();
  });

  it("shows whether the last export is current", () => {
    const project = useProjectStore.getState().project;
    if (!project) throw new Error("Missing project");
    useGenerateStore.setState({
      status: "ready",
      projectId: project.id,
      revision: 0,
      result: generateResult(),
      selectedByProject: { [project.id]: "README.md" },
      exportedByProject: { [project.id]: { revision: 0, path: "/tmp/blog-api" } },
    });

    const view = render(<PreviewScreen />);
    expect(screen.getByText("Exported")).toBeInTheDocument();
    expect(screen.getByText("/tmp/blog-api")).toBeInTheDocument();

    useProjectStore.setState({ revision: 1 });
    view.rerender(<PreviewScreen />);
    expect(screen.getByText("Export stale")).toBeInTheDocument();
  });

  it("toggles between Code and Diff view mode when diff data is available", () => {
    const project = useProjectStore.getState().project;
    if (!project) throw new Error("Missing project");

    const prevResult = generateResult();
    const newFiles: GeneratedFile[] = [
      { path: "README.md", content: "# Blog Updated\n", kind: "markdown" },
      { path: "src/main.ts", content: "export const main = true;\n", kind: "typescript" },
    ];
    const currResult: GenerateResult = {
      files: newFiles,
      tree: buildFileTree(newFiles, "blog-api"),
      issues: [],
      stats: { fileCount: 2, totalBytes: 50, byKind: { typescript: 1, json: 0, config: 0, markdown: 1, env: 0, docker: 0 } },
      warnings: [],
    };

    useGenerateStore.setState({
      status: "ready",
      projectId: project.id,
      revision: 1,
      result: currResult,
      previousResult: prevResult,
      viewMode: "code",
      selectedByProject: { [project.id]: "README.md" },
    });

    render(<PreviewScreen />);

    // Initially in Code view
    expect(screen.getByTestId("code-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("diff-viewer")).not.toBeInTheDocument();

    const diffButton = screen.getByRole("button", { name: "Diff" });
    expect(diffButton).not.toBeDisabled();

    fireEvent.click(diffButton);

    // Switched to Diff view
    expect(useGenerateStore.getState().viewMode).toBe("diff");
    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("diff-viewer")).toHaveTextContent("README.md [modified]");

    // Switch back to Code view
    const codeButton = screen.getByRole("button", { name: "Code" });
    fireEvent.click(codeButton);
    expect(useGenerateStore.getState().viewMode).toBe("code");
    expect(screen.getByTestId("code-viewer")).toBeInTheDocument();
  });
});

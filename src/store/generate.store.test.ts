import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateResult } from "@/core/generate";
import { buildFileTree } from "@/core/ir/tree";
import { createProject } from "@/core/model/defaults";
import { useGenerateStore } from "./generate.store";
import { useProjectStore } from "./project.store";
import { useUiStore } from "./ui.store";

vi.mock("@/core/generate", () => ({
  generateProject: vi.fn(),
}));

vi.mock("@/core/export/zip", () => ({
  createProjectZip: vi.fn(),
}));

const { generateProject } = await import("@/core/generate");
const { createProjectZip } = await import("@/core/export/zip");

function result(): GenerateResult {
  const files = [
    { path: "README.md", content: "# Blog\n", kind: "markdown" as const },
    { path: "src/main.ts", content: "export const main = true;\n", kind: "typescript" as const },
  ];
  return {
    files,
    tree: buildFileTree(files, "blog-api"),
    issues: [],
    stats: {
      fileCount: 2,
      totalBytes: 40,
      byKind: { typescript: 1, json: 0, config: 0, markdown: 1, env: 0, docker: 0 },
    },
    warnings: [],
  };
}

describe("useGenerateStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    const project = createProject("Blog API");
    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
    useProjectStore.getState().openProject(project);
    useGenerateStore.getState().reset();
    useUiStore.setState({ toasts: [] });
    vi.mocked(generateProject).mockReset();
    vi.mocked(createProjectZip).mockReset();
  });

  it("keeps the generated project snapshot and selects the first file", async () => {
    vi.mocked(generateProject).mockResolvedValue(result());
    await useGenerateStore.getState().run();

    const state = useGenerateStore.getState();
    const project = useProjectStore.getState().project;
    expect(state.status).toBe("ready");
    expect(state.result?.files).toHaveLength(2);
    expect(state.projectSnapshot?.id).toBe(project?.id);
    expect(state.selectedByProject[project?.id ?? ""]).toBe("README.md");
  });

  it("publishes a fast preview before background formatting finishes", async () => {
    const preview = result();
    const formatted = result();
    let resolveFormatted!: (value: GenerateResult) => void;
    const formattedPromise = new Promise<GenerateResult>((resolve) => {
      resolveFormatted = resolve;
    });

    vi.mocked(generateProject).mockImplementation((_project, options) =>
      options?.format === false ? Promise.resolve(preview) : formattedPromise,
    );

    const run = useGenerateStore.getState().run();
    await vi.waitFor(() => expect(useGenerateStore.getState().formatting).toBe(true));
    expect(useGenerateStore.getState().status).toBe("ready");
    expect(useGenerateStore.getState().result).toBe(preview);

    resolveFormatted(formatted);
    await run;

    expect(useGenerateStore.getState().formatting).toBe(false);
    expect(useGenerateStore.getState().result).toBe(formatted);
    expect(generateProject).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: true }),
    );
  });

  it("downloads a ZIP from the preview snapshot after the model changes", async () => {
    vi.mocked(generateProject).mockResolvedValue(result());
    await useGenerateStore.getState().run();

    const project = useProjectStore.getState().project;
    if (!project) throw new Error("Missing project");
    useProjectStore.setState({ project: { ...project, packageName: "renamed-api" } });

    vi.mocked(createProjectZip).mockResolvedValue({
      zip: new Uint8Array([1, 2, 3]),
      fileName: "blog-api-2026-01-02.zip",
      manifest: "{}",
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

    await useGenerateStore.getState().downloadZip();

    expect(createProjectZip).toHaveBeenCalledWith(
      expect.objectContaining({ id: project.id, packageName: "blog-api" }),
      expect.arrayContaining([expect.objectContaining({ path: "README.md" })]),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("tracks the exported revision per project", async () => {
    vi.mocked(generateProject).mockResolvedValue(result());
    await useGenerateStore.getState().run();

    const project = useProjectStore.getState().project;
    if (!project) throw new Error("Missing project");
    const revision = useProjectStore.getState().revision;
    useGenerateStore.getState().markExported(project.id, revision, "/tmp/blog-api");

    expect(useGenerateStore.getState().exportedByProject[project.id]).toEqual({
      revision,
      path: "/tmp/blog-api",
    });

    useGenerateStore.getState().reset();
    expect(useGenerateStore.getState().exportedByProject).toEqual({});
  });

  it("clears a stale preview when generation throws", async () => {
    vi.mocked(generateProject).mockRejectedValue(new Error("boom"));
    await useGenerateStore.getState().run();

    const state = useGenerateStore.getState();
    expect(state.status).toBe("error");
    expect(state.result).toBeNull();
    expect(state.projectSnapshot).toBeNull();
    expect(state.error).toContain("boom");
  });

  it("does not generate without an open project", async () => {
    useProjectStore.setState({ project: null });
    await useGenerateStore.getState().run();
    expect(generateProject).not.toHaveBeenCalled();
    expect(useGenerateStore.getState().status).toBe("idle");
  });

  it("retains previous result and computes diffs on subsequent generation", async () => {
    // Initial run
    const initialResult = result();
    vi.mocked(generateProject).mockResolvedValue(initialResult);
    await useGenerateStore.getState().run();

    expect(useGenerateStore.getState().previousResult).toBeNull();
    expect(useGenerateStore.getState().viewMode).toBe("code");

    useGenerateStore.getState().setViewMode("diff");
    expect(useGenerateStore.getState().viewMode).toBe("diff");

    // Second run with modifications
    const updatedFiles = [
      { path: "README.md", content: "# Blog\n", kind: "markdown" as const }, // unchanged
      { path: "src/main.ts", content: "export const main = false;\n", kind: "typescript" as const }, // modified
      { path: "src/new.ts", content: "export const extra = true;\n", kind: "typescript" as const }, // added
    ];
    const secondResult: GenerateResult = {
      files: updatedFiles,
      tree: buildFileTree(updatedFiles, "blog-api"),
      issues: [],
      stats: {
        fileCount: 3,
        totalBytes: 70,
        byKind: { typescript: 2, json: 0, config: 0, markdown: 1, env: 0, docker: 0 },
      },
      warnings: [],
    };

    vi.mocked(generateProject).mockResolvedValue(secondResult);
    await useGenerateStore.getState().run();

    const state = useGenerateStore.getState();
    expect(state.previousResult).toBe(initialResult);
    expect(state.result).toBe(secondResult);

    // Diff inspections
    const mainDiff = state.getFileDiff("src/main.ts");
    expect(mainDiff).toEqual({
      path: "src/main.ts",
      original: "export const main = true;\n",
      modified: "export const main = false;\n",
      status: "modified",
    });
    expect(state.getFileDiffStatus("src/main.ts")).toBe("modified");

    const newDiff = state.getFileDiff("src/new.ts");
    expect(newDiff).toEqual({
      path: "src/new.ts",
      original: null,
      modified: "export const extra = true;\n",
      status: "added",
    });
    expect(state.getFileDiffStatus("src/new.ts")).toBe("added");

    const readmeDiff = state.getFileDiff("README.md");
    expect(readmeDiff).toEqual({
      path: "README.md",
      original: "# Blog\n",
      modified: "# Blog\n",
      status: "unchanged",
    });
    expect(state.getFileDiffStatus("README.md")).toBe("unchanged");

    const summary = state.getDiffSummary();
    expect(summary).toEqual({
      added: 1,
      modified: 1,
      unchanged: 1,
    });
  });
});

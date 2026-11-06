import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "@/core/model/defaults";
import type { Project } from "@/core/model/schema";
import { ExportDialog } from "./ExportDialog";

const mocks = vi.hoisted(() => ({
  readManifest: vi.fn(),
  writeFiles: vi.fn(),
  pickExportFolder: vi.fn(),
  revealPath: vi.fn(),
}));

vi.mock("@/lib/tauri", () => ({
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  pickExportFolder: mocks.pickExportFolder,
  readManifest: mocks.readManifest,
  revealPath: mocks.revealPath,
}));

vi.mock("@/lib/files", () => ({
  writeFiles: mocks.writeFiles,
}));

function projectWithLastExport(): Project {
  const project = createProject("Blog API");
  project.lastExportPath = "/tmp/blog-api";
  return project;
}

describe("ExportDialog", () => {
  beforeEach(() => {
    mocks.readManifest.mockReset();
    mocks.writeFiles.mockReset();
    mocks.pickExportFolder.mockReset();
    mocks.revealPath.mockReset();
  });

  it("requires confirmation for untracked files and adopts them when overwritten", async () => {
    mocks.readManifest.mockResolvedValue({
      manifest: null,
      existing: [{ path: "src/untracked.ts", sha256: "local", mtime: 1 }],
      isEmpty: false,
      hasManifest: false,
    });
    mocks.writeFiles
      .mockResolvedValueOnce({
        written: ["src/new.ts", "src/untracked.ts"],
        skipped: [],
        failed: [],
      })
      .mockResolvedValueOnce({
        written: ["chz-nest.json"],
        skipped: [],
        failed: [],
      });

    const files = [
      { path: "src/new.ts", content: "new\n", kind: "typescript" as const },
      { path: "src/untracked.ts", content: "generated\n", kind: "typescript" as const },
    ];

    render(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        project={projectWithLastExport()}
        files={files}
        onExported={() => undefined}
      />,
    );

    expect(await screen.findByText("1 untracked")).toBeInTheDocument();
    expect(screen.getByText("Files needing a decision (1)")).toBeInTheDocument();
    const action = screen.getByRole("combobox");
    expect(action).toHaveValue("skip");

    const exportButton = screen.getByRole("button", { name: "Export" });
    expect(exportButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(action).toHaveValue("overwrite");
    expect(exportButton).toBeEnabled();

    fireEvent.click(exportButton);
    await waitFor(() => expect(mocks.writeFiles).toHaveBeenCalledTimes(2));

    const [folder, writes] = mocks.writeFiles.mock.calls[0] as [
      string,
      Array<{ path: string; strategy: string }>,
    ];
    expect(folder).toBe("/tmp/blog-api");
    expect(writes).toContainEqual({
      path: "src/untracked.ts",
      content: "generated\n",
      strategy: "overwrite",
    });

    const manifestCall = mocks.writeFiles.mock.calls[1] as [
      string,
      Array<{ path: string; content: string }>,
    ];
    const manifest = JSON.parse(manifestCall[1][0]?.content ?? "{}") as {
      files: Record<string, string>;
    };
    expect(manifest.files).toHaveProperty("src/untracked.ts");
  });

  it("keeps a skipped disk edit as a conflict in the next manifest", async () => {
    const oldHash = "a".repeat(64);
    mocks.readManifest.mockResolvedValue({
      manifest: {
        generator: "chz-nest",
        generatorVersion: "0.0.0",
        projectId: "prj_test",
        modelHash: "model",
        createdAt: "2026-01-01T00:00:00.000Z",
        files: { "src/local.ts": oldHash },
      },
      existing: [{ path: "src/local.ts", sha256: "b".repeat(64), mtime: 1 }],
      isEmpty: false,
      hasManifest: true,
    });
    mocks.writeFiles
      .mockResolvedValueOnce({
        written: [],
        skipped: ["src/local.ts"],
        failed: [],
      })
      .mockResolvedValueOnce({
        written: ["chz-nest.json"],
        skipped: [],
        failed: [],
      });

    render(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        project={projectWithLastExport()}
        files={[{ path: "src/local.ts", content: "generated\n", kind: "typescript" }]}
        onExported={() => undefined}
      />,
    );

    expect(await screen.findByText("1 changed on disk")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocks.writeFiles).toHaveBeenCalledTimes(2));

    const manifestCall = mocks.writeFiles.mock.calls[1] as [
      string,
      Array<{ path: string; content: string }>,
    ];
    const manifest = JSON.parse(manifestCall[1][0]?.content ?? "{}") as {
      files: Record<string, string>;
    };
    expect(manifest.files["src/local.ts"]).toBe(oldHash);
  });

  it("supports bulk conflict actions (Overwrite all, Skip all, .new all)", async () => {
    mocks.readManifest.mockResolvedValue({
      manifest: {
        generator: "chz-nest",
        generatorVersion: "0.0.0",
        projectId: "prj_test",
        modelHash: "model",
        createdAt: "2026-01-01T00:00:00.000Z",
        files: { "src/a.ts": "hash-a", "src/b.ts": "hash-b" },
      },
      existing: [
        { path: "src/a.ts", sha256: "modified-a", mtime: 1 },
        { path: "src/b.ts", sha256: "modified-b", mtime: 1 },
      ],
      isEmpty: false,
      hasManifest: true,
    });

    const files = [
      { path: "src/a.ts", content: "gen-a\n", kind: "typescript" as const },
      { path: "src/b.ts", content: "gen-b\n", kind: "typescript" as const },
    ];

    render(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        project={projectWithLastExport()}
        files={files}
        onExported={() => undefined}
      />,
    );

    expect(await screen.findByText("Files needing a decision (2)")).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    expect(selects[0]).toHaveValue("skip");
    expect(selects[1]).toHaveValue("skip");

    fireEvent.click(screen.getByRole("button", { name: "Overwrite all" }));
    expect(selects[0]).toHaveValue("overwrite");
    expect(selects[1]).toHaveValue("overwrite");

    fireEvent.click(screen.getByRole("button", { name: ".new all" }));
    expect(selects[0]).toHaveValue("new");
    expect(selects[1]).toHaveValue("new");

    fireEvent.click(screen.getByRole("button", { name: "Skip all" }));
    expect(selects[0]).toHaveValue("skip");
    expect(selects[1]).toHaveValue("skip");
  });

  it("allows picking a folder when no lastExportPath exists and reveals path on success", async () => {
    mocks.pickExportFolder.mockResolvedValue("/custom/export-dir");
    mocks.readManifest.mockResolvedValue({
      manifest: null,
      existing: [],
      isEmpty: true,
      hasManifest: false,
    });
    mocks.writeFiles.mockResolvedValue({
      written: ["src/app.ts"],
      skipped: [],
      failed: [],
    });

    const project = createProject("Empty API");
    project.lastExportPath = undefined;

    render(
      <ExportDialog
        open
        onOpenChange={() => undefined}
        project={project}
        files={[{ path: "src/app.ts", content: "console.log();\n", kind: "typescript" }]}
        onExported={() => undefined}
      />,
    );

    expect(screen.getByText("No folder selected")).toBeInTheDocument();
    const chooseButton = screen.getByRole("button", { name: "Choose" });

    fireEvent.click(chooseButton);
    expect(await screen.findByText("/custom/export-dir")).toBeInTheDocument();

    const exportBtn = screen.getByRole("button", { name: "Export" });
    expect(exportBtn).toBeEnabled();
    fireEvent.click(exportBtn);

    expect(await screen.findByRole("button", { name: "Open folder" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(mocks.revealPath).toHaveBeenCalledWith("/custom/export-dir");
  });
});


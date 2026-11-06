import { useMemo, useState } from "react";
import { errorMessage } from "@/lib/tauri";
import { useGenerateStore } from "@/store/generate.store";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { CodeViewer } from "./CodeViewer";
import { DiffViewer } from "./DiffViewer";
import { ExportDialog } from "./ExportDialog";
import { FileTreeView } from "./FileTreeView";
import { PreviewEmptyState } from "./components/PreviewEmptyState";
import { PreviewFileToolbar } from "./components/PreviewFileToolbar";
import { PreviewHeader } from "./components/PreviewHeader";
import { PreviewStatusBanners } from "./components/PreviewStatusBanners";

export function PreviewScreen() {
  const project = useProjectStore((state) => state.project);
  const revision = useProjectStore((state) => state.revision);
  const setLastExportPath = useProjectStore((state) => state.setLastExportPath);
  const pushToast = useUiStore((state) => state.pushToast);
  const {
    status,
    result,
    previousResult,
    viewMode,
    setViewMode,
    getFileDiff,
    getFileDiffStatus,
    getDiffSummary,
    formatting,
    projectId,
    revision: generatedRevision,
    selectedByProject,
    exportedByProject,
    selectFile,
    markExported,
    run,
    downloadZip,
    error,
  } = useGenerateStore();
  const [copied, setCopied] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const activeResult = projectId === project?.id ? result : null;
  const activeError = projectId === project?.id ? error : null;
  const selectedPath = project
    ? (selectedByProject[project.id] ?? activeResult?.files[0]?.path)
    : undefined;
  const selectedFile = useMemo(
    () => activeResult?.files.find((file) => file.path === selectedPath),
    [activeResult, selectedPath],
  );

  if (!project) return null;
  const currentProjectId = project.id;

  const stale = activeResult !== null && generatedRevision !== revision;
  const hasPreviousResult = previousResult !== null && projectId === project.id;
  const diffInfo = selectedFile ? getFileDiff(selectedFile.path) : null;
  const diffSummary = getDiffSummary();
  const exportRecord = exportedByProject[currentProjectId];
  const lastExportPath = exportRecord?.path ?? project.lastExportPath;
  const exportStale = exportRecord !== undefined && exportRecord.revision !== revision;
  const issues = activeResult?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = activeResult?.warnings ?? [];
  const running = status === "running";

  async function handleCopy() {
    if (!selectedFile) return;
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      pushToast({ kind: "success", title: "Copied file contents" });
    } catch (copyError) {
      pushToast({
        kind: "error",
        title: "Could not copy file",
        message: errorMessage(copyError),
        detail: errorMessage(copyError),
      });
    }
  }

  async function handleDownload() {
    if (formatting) return;
    setArchiving(true);
    try {
      await downloadZip();
      pushToast({ kind: "success", title: "ZIP download started" });
    } catch (archiveError) {
      pushToast({
        kind: "error",
        title: "Could not create ZIP",
        message: errorMessage(archiveError),
        detail: errorMessage(archiveError),
      });
    } finally {
      setArchiving(false);
    }
  }

  function handleExported(folder: string): void {
    setLastExportPath(folder);
    markExported(currentProjectId, revision, folder);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-4 p-6">
      <PreviewHeader
        stale={stale}
        status={status}
        formatting={formatting}
        exportStale={exportStale}
        hasExportRecord={Boolean(exportRecord)}
        running={running}
        hasActiveResult={Boolean(activeResult)}
        fileCount={activeResult?.files.length ?? 0}
        archiving={archiving}
        onGenerate={() => {
          setExportOpen(false);
          void run();
        }}
        onDownload={() => void handleDownload()}
        onOpenExport={() => setExportOpen(true)}
      />

      <PreviewStatusBanners
        lastExportPath={lastExportPath}
        hasExportRecord={Boolean(exportRecord)}
        exportStale={exportStale}
        fileCount={activeResult?.stats.fileCount}
        totalBytes={activeResult?.stats.totalBytes}
        driver={project.driver}
        stale={stale}
        warnings={warnings}
      />

      {!activeResult || activeResult.files.length === 0 ? (
        <PreviewEmptyState error={activeError} issues={issues} />
      ) : (
        <div className="grid min-h-[32rem] flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface/40 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="max-h-[70vh] overflow-y-auto border-b border-border p-2 scrollbar-thin lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Files</span>
              <div className="flex items-center gap-1.5">
                {hasPreviousResult && (diffSummary.modified > 0 || diffSummary.added > 0) ? (
                  <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-mono text-accent">
                    {diffSummary.modified > 0 ? `${diffSummary.modified} Δ` : ""}{" "}
                    {diffSummary.added > 0 ? `+${diffSummary.added}` : ""}
                  </span>
                ) : null}
                <span className="text-[11px] text-muted">{activeResult.stats.fileCount}</span>
              </div>
            </div>
            <FileTreeView
              tree={activeResult.tree}
              selectedPath={selectedPath}
              getFileDiffStatus={hasPreviousResult ? getFileDiffStatus : undefined}
              onSelect={(path) => selectFile(project.id, path)}
            />
          </aside>

          <section className="flex min-h-0 flex-col">
            <PreviewFileToolbar
              selectedFile={selectedFile}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              hasPreviousResult={hasPreviousResult}
              copied={copied}
              onCopy={() => void handleCopy()}
            />

            <div className="min-h-[28rem] flex-1">
              {selectedFile ? (
                viewMode === "diff" && diffInfo ? (
                  <DiffViewer
                    path={diffInfo.path}
                    original={diffInfo.original}
                    modified={diffInfo.modified}
                    status={diffInfo.status}
                  />
                ) : (
                  <CodeViewer path={selectedFile.path} content={selectedFile.content} />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Select a file from the tree.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeResult && !stale ? (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          project={project}
          files={activeResult.files}
          onExported={handleExported}
        />
      ) : null}
    </div>
  );
}

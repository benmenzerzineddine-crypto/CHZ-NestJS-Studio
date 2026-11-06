import {
  FolderOpen,
  FolderSearch,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildExportPlan,
  isConflictStatus,
  manifestOverrides,
  resolveExportWrites,
  type ConflictAction,
  type ExportPlan,
} from "@/core/export/plan";
import {
  createManifest,
  parseProjectManifest,
  type ProjectManifest,
} from "@/core/export/manifest";
import type { GeneratedFile } from "@/core/ir/types";
import type { Project } from "@/core/model/schema";
import { writeFiles, type WriteReport } from "@/lib/files";
import {
  errorMessage,
  pickExportFolder,
  readManifest,
  revealPath,
} from "@/lib/tauri";
import { useUiStore } from "@/store/ui.store";
import { ExportConflictsSection } from "./components/ExportConflictsSection";
import { ExportFolderPicker } from "./components/ExportFolderPicker";
import { ExportPlanSummary } from "./components/ExportPlanSummary";
import { ExportStatusBanners } from "./components/ExportStatusBanners";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  files: GeneratedFile[];
  onExported: (folder: string) => void;
}

export function ExportDialog({
  open,
  onOpenChange,
  project,
  files,
  onExported,
}: ExportDialogProps) {
  const pushToast = useUiStore((state) => state.pushToast);
  const [folder, setFolder] = useState("");
  const [hasManifest, setHasManifest] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [actions, setActions] = useState<Record<string, ConflictAction>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<WriteReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadFolder(path: string): Promise<void> {
    setFolder(path);
    setLoading(true);
    setError(null);
    setReport(null);
    setPlan(null);
    setHasManifest(false);
    setIsEmpty(true);
    setManifest(null);
    setConfirmed(false);
    setActions({});

    try {
      const disk = await readManifest(
        path,
        files.map((file) => file.path),
      );
      const parsed = disk.hasManifest ? parseProjectManifest(disk.manifest) : null;
      const nextPlan = await buildExportPlan(files, parsed, disk.existing);
      const nextActions: Record<string, ConflictAction> = {};
      for (const entry of nextPlan.entries) {
        if (isConflictStatus(entry.status)) nextActions[entry.path] = "skip";
      }

      setHasManifest(disk.hasManifest);
      setIsEmpty(disk.isEmpty);
      setManifest(parsed);
      setPlan(nextPlan);
      setActions(nextActions);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (project.lastExportPath) {
      void loadFolder(project.lastExportPath);
    } else {
      setFolder("");
      setPlan(null);
      setHasManifest(false);
      setIsEmpty(true);
      setManifest(null);
      setActions({});
      setConfirmed(false);
      setReport(null);
      setError(null);
    }
    // Only run when the dialog opens; the folder can be changed from the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleChooseFolder(): Promise<void> {
    try {
      const selected = await pickExportFolder();
      if (selected) await loadFolder(selected);
    } catch (chooseError) {
      setError(errorMessage(chooseError));
    }
  }

  function setAllConflicts(action: ConflictAction): void {
    if (!plan) return;
    const next: Record<string, ConflictAction> = {};
    for (const entry of plan.entries) {
      if (isConflictStatus(entry.status)) next[entry.path] = action;
    }
    setActions(next);
  }

  function setConfirmation(value: boolean): void {
    setConfirmed(value);
    if (hasManifest) return;

    setActions((current) => {
      const next = { ...current };
      for (const entry of plan?.entries ?? []) {
        if (entry.status === "untracked") next[entry.path] = value ? "overwrite" : "skip";
      }
      return next;
    });
  }

  async function handleExport(): Promise<void> {
    if (!plan || !folder) return;
    if (!hasManifest && !isEmpty && !confirmed) return;

    setExporting(true);
    setError(null);
    setReport(null);

    try {
      const writes = resolveExportWrites(plan, files, actions);
      const result = await writeFiles(folder, writes);
      if (result.failed.length > 0) {
        setReport(result);
        setError(
          `Some files could not be written (${result.failed.length}). The manifest was not updated.`,
        );
        return;
      }

      const overrides = manifestOverrides(plan, manifest, actions);
      const { content } = await createManifest(
        project,
        files,
        new Date(),
        overrides.hashes,
        overrides.omitted,
      );
      const manifestResult = await writeFiles(folder, [
        { path: "chz-nest.json", content, strategy: "overwrite" },
      ]);
      if (manifestResult.failed.length > 0) {
        setReport({ ...result, failed: manifestResult.failed });
        setError("The generated files were written, but the manifest could not be updated.");
        return;
      }

      setReport({
        written: [...result.written, ...manifestResult.written],
        skipped: result.skipped,
        failed: [],
      });
      onExported(folder);
      pushToast({
        kind: "success",
        title: "Project exported",
        message: `${result.written.length} files written to ${folder}.`,
      });
    } catch (exportError) {
      setError(errorMessage(exportError));
    } finally {
      setExporting(false);
    }
  }

  async function handleReveal(): Promise<void> {
    try {
      await revealPath(folder);
    } catch (revealError) {
      pushToast({
        kind: "error",
        title: "Could not open the folder",
        message: errorMessage(revealError),
        detail: errorMessage(revealError),
      });
    }
  }

  const conflicts = plan?.entries.filter((entry) => isConflictStatus(entry.status)) ?? [];
  const needsConfirmation = !hasManifest && !isEmpty;
  const canExport =
    Boolean(plan) &&
    !loading &&
    !exporting &&
    (!needsConfirmation || confirmed) &&
    (plan?.entries.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export generated project</DialogTitle>
          <DialogDescription>
            Write the generated files directly into a folder. Existing files with local changes
            are never overwritten unless you choose to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ExportFolderPicker
            folder={folder}
            loading={loading}
            exporting={exporting}
            onChooseFolder={() => void handleChooseFolder()}
          />

          <ExportStatusBanners
            loading={loading}
            error={error}
            report={report}
            needsConfirmation={needsConfirmation}
            confirmed={confirmed}
            onConfirmChange={setConfirmation}
          />

          {plan ? (
            <>
              <ExportPlanSummary plan={plan} hasManifest={hasManifest} />

              <ExportConflictsSection
                conflicts={conflicts}
                actions={actions}
                onActionChange={(path, action) =>
                  setActions((current) => ({ ...current, [path]: action }))
                }
                onSetAllConflicts={setAllConflicts}
              />
            </>
          ) : null}
        </div>

        <DialogFooter>
          {report && report.failed.length === 0 ? (
            <Button variant="secondary" onClick={() => void handleReveal()}>
              <FolderOpen className="h-4 w-4" />
              Open folder
            </Button>
          ) : null}
          <Button variant="secondary" disabled={loading || exporting} onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={!canExport}
            onClick={() => void handleExport()}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : report && report.failed.length === 0 ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <FolderSearch className="h-4 w-4" />
            )}
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
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

export function useExportPlan(
  project: Project,
  files: GeneratedFile[],
  open: boolean,
  onExported: (folder: string) => void,
) {
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
  }, [open, project.lastExportPath]);

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
      });
    }
  }

  function setAction(path: string, action: ConflictAction): void {
    setActions((current) => ({ ...current, [path]: action }));
  }

  return {
    folder,
    hasManifest,
    isEmpty,
    plan,
    actions,
    confirmed,
    loading,
    exporting,
    report,
    error,
    loadFolder,
    handleChooseFolder,
    setAllConflicts,
    setConfirmation,
    handleExport,
    handleReveal,
    setAction,
  };
}

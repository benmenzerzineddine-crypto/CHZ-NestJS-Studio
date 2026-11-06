import {
  FolderOpen,
  FolderSearch,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isConflictStatus } from "@/core/export/plan";
import type { GeneratedFile } from "@/core/ir/types";
import type { Project } from "@/core/model/schema";
import { ExportConflictsSection } from "./components/ExportConflictsSection";
import { ExportFolderPicker } from "./components/ExportFolderPicker";
import { ExportPlanSummary } from "./components/ExportPlanSummary";
import { ExportStatusBanners } from "./components/ExportStatusBanners";
import { useExportPlan } from "./useExportPlan";

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
  const {
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
    handleChooseFolder,
    setAllConflicts,
    setConfirmation,
    handleExport,
    handleReveal,
    setAction,
  } = useExportPlan(project, files, open, onExported);

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
                onActionChange={setAction}
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

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { WriteReport } from "@/lib/files";

export interface ExportStatusBannersProps {
  loading: boolean;
  error: string | null;
  report: WriteReport | null;
  needsConfirmation: boolean;
  confirmed: boolean;
  onConfirmChange: (confirmed: boolean) => void;
}

export function ExportStatusBanners({
  loading,
  error,
  report,
  needsConfirmation,
  confirmed,
  onConfirmChange,
}: ExportStatusBannersProps) {
  return (
    <>
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading the target folder…
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {report && report.failed.length === 0 && !error ? (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Export complete: {report.written.length} written, {report.skipped.length} skipped.
          </span>
        </div>
      ) : null}

      {needsConfirmation ? (
        <label className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <Checkbox
            className="mt-0.5"
            checked={confirmed}
            onChange={(event) => onConfirmChange(event.currentTarget.checked)}
          />
          <span>
            This folder already contains files but no chz-nest.json manifest. Exporting can
            overwrite files with matching names. I understand and want to continue.
          </span>
        </label>
      ) : null}
    </>
  );
}

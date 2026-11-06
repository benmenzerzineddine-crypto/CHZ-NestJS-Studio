import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GENERATOR_VERSION } from "@/core/version";
import { formatBytes } from "../format-bytes";

export interface PreviewStatusBannersProps {
  lastExportPath?: string;
  hasExportRecord: boolean;
  exportStale: boolean;
  fileCount?: number;
  totalBytes?: number;
  driver: string;
  stale: boolean;
  warnings: string[];
}

export function PreviewStatusBanners({
  lastExportPath,
  hasExportRecord,
  exportStale,
  fileCount,
  totalBytes,
  driver,
  stale,
  warnings,
}: PreviewStatusBannersProps) {
  return (
    <>
      {lastExportPath ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Last export:</span>
          <span className="max-w-full truncate font-mono text-foreground">{lastExportPath}</span>
          {hasExportRecord ? (
            exportStale ? (
              <Badge variant="warning">Project changed since export</Badge>
            ) : (
              <Badge variant="success">Current</Badge>
            )
          ) : null}
        </div>
      ) : null}

      {fileCount !== undefined && totalBytes !== undefined ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <Badge variant="accent">{fileCount} files</Badge>
          <span>{formatBytes(totalBytes)}</span>
          <span>Generator {GENERATOR_VERSION}</span>
          <span>{driver}</span>
        </div>
      ) : null}

      {stale ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          The project changed after this preview. Regenerate to refresh the files before exporting.
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </>
  );
}

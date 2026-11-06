import { Download, FolderOutput, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PreviewHeaderProps {
  stale: boolean;
  status: string;
  formatting: boolean;
  exportStale: boolean;
  hasExportRecord: boolean;
  running: boolean;
  hasActiveResult: boolean;
  fileCount: number;
  archiving: boolean;
  onGenerate: () => void;
  onDownload: () => void;
  onOpenExport: () => void;
}

export function PreviewHeader({
  stale,
  status,
  formatting,
  exportStale,
  hasExportRecord,
  running,
  hasActiveResult,
  fileCount,
  archiving,
  onGenerate,
  onDownload,
  onOpenExport,
}: PreviewHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h1 className="text-lg font-semibold">Generate API</h1>
          {stale ? <Badge variant="warning">Model changed</Badge> : null}
          {status === "ready" && !stale ? <Badge variant="success">Up to date</Badge> : null}
          {formatting ? <Badge variant="warning">Formatting…</Badge> : null}
          {exportStale ? <Badge variant="warning">Export stale</Badge> : null}
          {hasExportRecord && !exportStale ? <Badge variant="success">Exported</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          Validate, preview and export a complete NestJS + TypeORM project.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={running} onClick={onGenerate}>
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasActiveResult ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {running ? "Generating…" : hasActiveResult ? "Regenerate" : "Generate"}
        </Button>
        <Button
          variant="secondary"
          disabled={!hasActiveResult || fileCount === 0 || archiving || formatting}
          onClick={onDownload}
        >
          {archiving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          ZIP
        </Button>
        <Button
          disabled={!hasActiveResult || fileCount === 0 || stale || running || formatting}
          onClick={onOpenExport}
        >
          <FolderOutput className="h-4 w-4" />
          Export folder
        </Button>
      </div>
    </header>
  );
}

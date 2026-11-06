import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeneratedFile } from "@/core/ir/types";
import { cn } from "@/lib/cn";
import { formatBytes } from "../format-bytes";

export interface PreviewFileToolbarProps {
  selectedFile?: GeneratedFile;
  viewMode: "code" | "diff";
  onViewModeChange: (mode: "code" | "diff") => void;
  hasPreviousResult: boolean;
  copied: boolean;
  onCopy: () => void;
}

export function PreviewFileToolbar({
  selectedFile,
  viewMode,
  onViewModeChange,
  hasPreviousResult,
  copied,
  onCopy,
}: PreviewFileToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-foreground">
          {selectedFile?.path ?? "Select a file"}
        </p>
        {selectedFile ? (
          <p className="text-[11px] text-muted">
            {selectedFile.kind} · {formatBytes(new Blob([selectedFile.content]).size)}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onViewModeChange("code")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === "code"
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground",
            )}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("diff")}
            disabled={!hasPreviousResult}
            title={
              hasPreviousResult
                ? "Compare with previous generation"
                : "Regenerate after editing model to view diff"
            }
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              viewMode === "diff"
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground",
            )}
          >
            Diff
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          disabled={!selectedFile}
          onClick={onCopy}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

import { FilePlus, FileText, GitCompare, Loader2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { languageFor } from "./CodeViewer";

const MonacoDiffEditor = lazy(async () => {
  const module = await import("@monaco-editor/react");
  return { default: module.DiffEditor };
});

export interface DiffViewerProps {
  path: string;
  original: string | null;
  modified: string;
  status: "added" | "modified" | "unchanged";
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading diff editor…
    </div>
  );
}

export function DiffViewer({ path, original, modified, status }: DiffViewerProps) {
  const [sideBySide, setSideBySide] = useState(true);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-raised/40 px-4 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          {status === "added" ? (
            <Badge variant="success" className="gap-1">
              <FilePlus className="h-3 w-3" />
              New file (added)
            </Badge>
          ) : status === "modified" ? (
            <Badge variant="warning" className="gap-1">
              <GitCompare className="h-3 w-3" />
              Modified
            </Badge>
          ) : (
            <Badge variant="default" className="gap-1">
              <FileText className="h-3 w-3" />
              Unchanged
            </Badge>
          )}
          <span className="text-[11px] text-muted">
            {status === "added"
              ? "This file did not exist in the previous generation."
              : status === "modified"
                ? "Comparing against previous generation."
                : "Content is identical to previous generation."}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => setSideBySide(!sideBySide)}
        >
          {sideBySide ? "Inline view" : "Side-by-side view"}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <Suspense fallback={<Loading />}>
          <MonacoDiffEditor
            height="100%"
            original={original ?? ""}
            modified={modified}
            language={languageFor(path)}
            theme="vs-dark"
            loading={<Loading />}
            options={{
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineHeight: 20,
              renderSideBySide: sideBySide,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderLineHighlight: "none",
              padding: { top: 12, bottom: 12 },
              scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

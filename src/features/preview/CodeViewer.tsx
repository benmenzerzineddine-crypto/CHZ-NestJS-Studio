import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";

const MonacoEditor = lazy(async () => {
  const module = await import("@monaco-editor/react");
  return { default: module.Editor };
});

interface CodeViewerProps {
  path: string;
  content: string;
}

export function languageFor(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  return "plaintext";
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading editor…
    </div>
  );
}

export function CodeViewer({ path, content }: CodeViewerProps) {
  return (
    <Suspense fallback={<Loading />}>
      <MonacoEditor
        height="100%"
        path={path}
        language={languageFor(path)}
        value={content}
        theme="vs-dark"
        loading={<Loading />}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          fontSize: 12,
          lineHeight: 20,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          renderLineHighlight: "none",
          padding: { top: 12, bottom: 12 },
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
      />
    </Suspense>
  );
}

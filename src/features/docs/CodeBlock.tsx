import { Check, Copy } from "lucide-react";
import { useState } from "react";

export interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative my-3 overflow-hidden rounded-lg border border-border bg-canvas">
      <div className="flex items-center justify-between border-b border-border/80 bg-surface-raised/50 px-3 py-1.5 text-[11px] text-muted">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-surface-hover hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-foreground font-mono scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}

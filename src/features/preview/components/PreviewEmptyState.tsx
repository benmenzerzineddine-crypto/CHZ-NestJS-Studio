import { FileCode2 } from "lucide-react";
import type { ValidationIssue } from "@/core/validate/validate";

export interface PreviewEmptyStateProps {
  error: string | null;
  issues: ValidationIssue[];
}

export function PreviewEmptyState({ error, issues }: PreviewEmptyStateProps) {
  return (
    <section className="rounded-xl border border-border bg-surface/50 p-8">
      <div className="flex items-start gap-3">
        <FileCode2 className="mt-0.5 h-5 w-5 text-accent" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">No generated files yet</h2>
          <p className="mt-1 text-xs text-muted">
            {error ??
              "Run the generator to build the project tree. Invalid models are blocked before any file is emitted."}
          </p>
          {issues.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {issues.map((issue) => (
                <li
                  key={`${issue.code}-${issue.entityId ?? ""}-${issue.fieldId ?? ""}-${issue.message}`}
                  className="rounded-md border border-danger/25 bg-danger/5 px-3 py-2"
                >
                  <p className="text-xs text-danger">{issue.message}</p>
                  {issue.fixHint ? (
                    <p className="mt-1 text-[11px] text-muted">{issue.fixHint}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

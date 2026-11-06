import { AlertCircle, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import {
  countIssues,
  validateProject,
  type ValidationIssue,
} from "@/core/validate/validate";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

export function ValidationPanel() {
  const project = useProjectStore((state) => state.project);
  const setScreen = useUiStore((state) => state.setScreen);
  const setDesignerTab = useUiStore((state) => state.setDesignerTab);
  const selectEntity = useUiStore((state) => state.selectEntity);
  const selectField = useUiStore((state) => state.selectField);
  const selectEnum = useUiStore((state) => state.selectEnum);
  const open = useUiStore((state) => state.validationOpen);
  const setOpen = useUiStore((state) => state.setValidationOpen);

  const issues = useMemo(
    () => (project ? validateProject(project) : []),
    [project],
  );
  const counts = countIssues(issues);

  if (!project) return null;

  const tone =
    counts.errors > 0
      ? "border-danger/30 bg-danger/5"
      : counts.warnings > 0
        ? "border-warning/30 bg-warning/5"
        : "border-success/30 bg-success/5";

  const badgeVariant =
    counts.errors > 0 ? "danger" : counts.warnings > 0 ? "warning" : "success";

  function contextFor(issue: ValidationIssue): string | null {
    if (!project) return null;
    const entity = issue.entityId
      ? project.entities.find((candidate) => candidate.id === issue.entityId)
      : undefined;
    const field = issue.fieldId
      ? entity?.fields.find((candidate) => candidate.id === issue.fieldId)
      : undefined;
    const relation = issue.relationId
      ? entity?.relations.find((candidate) => candidate.id === issue.relationId)
      : undefined;
    const enumDef = issue.enumId
      ? project.enums.find((candidate) => candidate.id === issue.enumId)
      : undefined;

    const parts = [
      entity?.name,
      field?.name ?? relation?.name,
      enumDef?.name,
      issue.operation,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" · ") : null;
  }

  function navigate(issue: ValidationIssue) {
    setOpen(false);

    if (issue.code.startsWith("auth.")) {
      setScreen("auth");
      return;
    }
    if (issue.code.startsWith("project.")) {
      setScreen("settings");
      return;
    }
    if (issue.code.startsWith("access.")) {
      if (issue.entityId) selectEntity(issue.entityId);
      setScreen("auth");
      return;
    }
    if (issue.enumId) {
      setDesignerTab("enums");
      selectEnum(issue.enumId);
      setScreen("entities");
      return;
    }
    if (issue.entityId) {
      setDesignerTab("entities");
      selectEntity(issue.entityId);
      if (issue.fieldId) selectField(issue.fieldId);
      setScreen("entities");
      return;
    }

    setScreen("auth");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full rounded-lg border p-3 text-left transition-colors hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          tone,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-muted" />
            Model checks
          </span>
          <Badge variant={badgeVariant}>
            {counts.errors > 0
              ? `${counts.errors} ${counts.errors === 1 ? "error" : "errors"}`
              : counts.warnings > 0
                ? `${counts.warnings} ${counts.warnings === 1 ? "warning" : "warnings"}`
                : "OK"}
          </Badge>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          {counts.errors > 0
            ? "Fix errors before generating."
            : counts.warnings > 0
              ? "Warnings do not block generation."
              : "Schema and access rules are valid."}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Model checks</DialogTitle>
            <DialogDescription>
              Errors block generation. Warnings are informational. Click an issue to jump to the
              offending part of the model.
            </DialogDescription>
          </DialogHeader>

          {issues.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-sm text-foreground">
                No issues found. The model is ready for the generator.
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1 scrollbar-thin">
              {(["error", "warning"] as const).map((severity) => {
                const group = issues.filter((issue) => issue.severity === severity);
                if (group.length === 0) return null;
                const Icon = severity === "error" ? AlertCircle : AlertTriangle;

                return (
                  <div key={severity}>
                    <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5",
                          severity === "error" ? "text-danger" : "text-warning",
                        )}
                      />
                      {severity === "error" ? "Errors" : "Warnings"} ({group.length})
                    </h3>
                    <div className="mt-2 space-y-1.5">
                      {group.map((issue, index) => {
                        const context = contextFor(issue);
                        return (
                          <button
                            key={`${issue.code}-${issue.entityId ?? ""}-${issue.fieldId ?? ""}-${issue.relationId ?? ""}-${issue.enumId ?? ""}-${issue.operation ?? ""}-${index}`}
                            type="button"
                            onClick={() => navigate(issue)}
                            className="w-full rounded-md border border-border bg-surface-raised/40 px-3 py-2 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                          >
                            <p className="text-sm text-foreground">{issue.message}</p>
                            <p className="mt-0.5 text-[11px] text-muted">
                              {context ? `${context} · ` : ""}
                              {issue.code}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

import type { ConflictAction, ExportEntryStatus, ExportPlan } from "../export/plan";
import { isConflictStatus } from "../export/plan";
import type { ValidationIssue } from "../validate/validate";

export type ConflictPolicy = "safe" | "overwrite";

export interface ConflictDecision {
  path: string;
  status: ExportEntryStatus;
  action: ConflictAction;
}

export interface PlanReport {
  counts: ExportPlan["counts"];
  summary: string;
  conflicts: ConflictDecision[];
}

const STATUS_LABELS: Record<ExportEntryStatus, string> = {
  new: "new",
  untracked: "untracked",
  unchanged: "unchanged",
  "generator-updated": "generator updates",
  "disk-modified": "changed on disk",
  "missing-from-disk": "missing",
};

/**
 * Default policy never touches files the user edited by hand. `overwrite` is an
 * explicit opt-in, mirroring the studio's "Overwrite all" action.
 */
export function conflictActions(
  plan: ExportPlan,
  policy: ConflictPolicy,
): Record<string, ConflictAction> {
  const actions: Record<string, ConflictAction> = {};
  if (policy === "overwrite") {
    for (const entry of plan.entries) {
      if (isConflictStatus(entry.status)) actions[entry.path] = "overwrite";
    }
  }
  return actions;
}

export function planSummary(plan: ExportPlan): string {
  const parts = [
    `${plan.counts.new} ${STATUS_LABELS.new}`,
    `${plan.counts.unchanged} ${STATUS_LABELS.unchanged}`,
  ];
  if (plan.counts["generator-updated"] > 0) {
    parts.push(`${plan.counts["generator-updated"]} ${STATUS_LABELS["generator-updated"]}`);
  }
  if (plan.counts["missing-from-disk"] > 0) {
    parts.push(`${plan.counts["missing-from-disk"]} ${STATUS_LABELS["missing-from-disk"]}`);
  }
  if (plan.counts["disk-modified"] > 0) {
    parts.push(`${plan.counts["disk-modified"]} ${STATUS_LABELS["disk-modified"]}`);
  }
  if (plan.counts.untracked > 0) {
    parts.push(`${plan.counts.untracked} ${STATUS_LABELS.untracked}`);
  }
  return parts.join(" · ");
}

export function conflictDecision(
  entry: ExportPlan["entries"][number],
  actions: Record<string, ConflictAction>,
): ConflictDecision {
  return { path: entry.path, status: entry.status, action: actions[entry.path] ?? "skip" };
}

export function planReport(plan: ExportPlan, actions: Record<string, ConflictAction>): PlanReport {
  return {
    counts: plan.counts,
    summary: planSummary(plan),
    conflicts: plan.entries
      .filter((entry) => isConflictStatus(entry.status))
      .map((entry) => conflictDecision(entry, actions)),
  };
}

export function conflictLine(decision: ConflictDecision): string {
  const verb =
    decision.action === "overwrite" ? "overwrite" : decision.action === "new" ? "write .new" : "skip";
  return `${verb} ${decision.path} (${STATUS_LABELS[decision.status]})`;
}

export function issueLine(issue: ValidationIssue): string {
  const hint = issue.fixHint ? ` — ${issue.fixHint}` : "";
  return `${issue.severity} ${issue.code}: ${issue.message}${hint}`;
}

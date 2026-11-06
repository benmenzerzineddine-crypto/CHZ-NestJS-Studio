import { Badge } from "@/components/ui/badge";
import type { ExportPlan } from "@/core/export/plan";

export interface ExportPlanSummaryProps {
  plan: ExportPlan;
  hasManifest: boolean;
}

const STATUS_VARIANT = {
  new: "accent",
  untracked: "warning",
  unchanged: "success",
  "generator-updated": "accent",
  "disk-modified": "warning",
  "missing-from-disk": "danger",
} as const;

export function ExportPlanSummary({ plan, hasManifest }: ExportPlanSummaryProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={STATUS_VARIANT.new}>{plan.counts.new} new</Badge>
        {plan.counts.untracked > 0 ? (
          <Badge variant={STATUS_VARIANT.untracked}>
            {plan.counts.untracked} untracked
          </Badge>
        ) : null}
        <Badge variant={STATUS_VARIANT.unchanged}>
          {plan.counts.unchanged} unchanged
        </Badge>
        {plan.counts["generator-updated"] > 0 ? (
          <Badge variant={STATUS_VARIANT["generator-updated"]}>
            {plan.counts["generator-updated"]} generator updates
          </Badge>
        ) : null}
        {plan.counts["disk-modified"] > 0 ? (
          <Badge variant={STATUS_VARIANT["disk-modified"]}>
            {plan.counts["disk-modified"]} changed on disk
          </Badge>
        ) : null}
        <Badge variant={STATUS_VARIANT["missing-from-disk"]}>
          {plan.counts["missing-from-disk"]} missing
        </Badge>
        {hasManifest ? <Badge>manifest found</Badge> : <Badge>no manifest</Badge>}
      </div>

      {plan.counts["generator-updated"] > 0 ? (
        <p className="text-[11px] text-muted">
          Files changed by the generator since the last export are overwritten
          automatically when the disk still matches the manifest.
        </p>
      ) : null}

      {plan.counts["missing-from-disk"] > 0 ? (
        <p className="text-[11px] text-muted">
          Files listed in the manifest but missing on disk will be written again.
        </p>
      ) : null}
    </>
  );
}

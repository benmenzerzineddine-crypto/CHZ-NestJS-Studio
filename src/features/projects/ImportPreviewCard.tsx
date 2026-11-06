import { Badge } from "@/components/ui/badge";
import type { ImportFormat } from "@/core/import";
import type { EntityDef, Project } from "@/core/model/schema";
import type { ValidationIssue } from "@/core/validate/validate";

export interface ParsedPreviewResult {
  ok: boolean;
  format: ImportFormat;
  project?: Project;
  errors?: ValidationIssue[];
  error?: string;
}

interface ImportPreviewCardProps {
  preview: ParsedPreviewResult | null;
}

export function ImportPreviewCard({ preview }: ImportPreviewCardProps) {
  if (!preview) return null;

  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        preview.ok
          ? "border-success/30 bg-success/5 text-foreground"
          : "border-warning/30 bg-warning/5 text-warning"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="accent" className="uppercase text-[9px]">
            {preview.format}
          </Badge>
          {preview.ok && preview.project ? (
            <span className="font-medium">
              Detected {preview.project.entities.length} entities and{" "}
              {preview.project.enums.length} enums
            </span>
          ) : (
            <span className="font-medium text-danger">Parsing incomplete</span>
          )}
        </div>
        {preview.ok ? (
          <Badge variant="success" className="text-[9px]">
            Valid
          </Badge>
        ) : null}
      </div>

      {preview.ok && preview.project ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {preview.project.entities.map((ent: EntityDef) => (
            <span
              key={ent.id}
              className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted font-mono"
            >
              {ent.name} ({ent.fields.length} cols, {ent.relations.length} rels)
            </span>
          ))}
        </div>
      ) : preview.error ? (
        <p className="mt-1 text-[11px] text-danger">{preview.error}</p>
      ) : null}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ConflictAction, ExportPlanEntry } from "@/core/export/plan";

export interface ExportConflictsSectionProps {
  conflicts: ExportPlanEntry[];
  actions: Record<string, ConflictAction>;
  onActionChange: (path: string, action: ConflictAction) => void;
  onSetAllConflicts: (action: ConflictAction) => void;
}

export function ExportConflictsSection({
  conflicts,
  actions,
  onActionChange,
  onSetAllConflicts,
}: ExportConflictsSectionProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          Files needing a decision ({conflicts.length})
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onSetAllConflicts("overwrite")}>
            Overwrite all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onSetAllConflicts("skip")}>
            Skip all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onSetAllConflicts("new")}>
            .new all
          </Button>
        </div>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2 scrollbar-thin">
        {conflicts.map((entry) => (
          <div
            key={entry.path}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
              {entry.path}
            </span>
            <Badge variant="warning">
              {entry.status === "untracked" ? "untracked" : "changed on disk"}
            </Badge>
            <Select
              className="w-32 shrink-0"
              value={actions[entry.path] ?? entry.defaultStrategy}
              onChange={(event) =>
                onActionChange(entry.path, event.currentTarget.value as ConflictAction)
              }
            >
              <option value="skip">Skip</option>
              <option value="overwrite">Overwrite</option>
              <option value="new">Write .new</option>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

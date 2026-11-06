import { Lock } from "lucide-react";
import type { EntityDef } from "@/core/model/schema";
import { cn } from "@/lib/cn";

export interface AccessEntityTabsProps {
  entities: EntityDef[];
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
}

export function AccessEntityTabs({
  entities,
  selectedEntityId,
  onSelectEntity,
}: AccessEntityTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
      {entities.map((candidate) => {
        const active = candidate.id === selectedEntityId;
        return (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onSelectEntity(candidate.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
              active
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-surface-raised text-muted hover:text-foreground",
            )}
          >
            {candidate.name}
            {candidate.options.owner ? <Lock className="h-3 w-3" /> : null}
          </button>
        );
      })}
    </div>
  );
}

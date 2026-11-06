import { Badge } from "@/components/ui/badge";
import type { DerivedInverse } from "@/core/model/normalize";
import type { Project } from "@/core/model/schema";
import { RELATION_LABELS } from "./RelationConstants";

export interface DerivedInversesListProps {
  inverses: DerivedInverse[];
  project: Project;
}

export function DerivedInversesList({
  inverses,
  project,
}: DerivedInversesListProps) {
  if (inverses.length === 0) return null;

  return (
    <div className="border-t border-border px-5 py-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
        Derived inverses
      </h3>
      <div className="mt-2 space-y-2">
        {inverses.map((inverse) => {
          const source = project.entities.find(
            (candidate) => candidate.id === inverse.sourceEntityId,
          );
          const sourceRelation = source?.relations.find(
            (relation) => relation.id === inverse.relationId,
          );

          return (
            <div
              key={`${inverse.sourceEntityId}-${inverse.relationId}`}
              className="flex flex-wrap items-center gap-2 text-xs"
            >
              <span className="font-mono text-foreground">{inverse.name}</span>
              <Badge>{RELATION_LABELS[inverse.kind]}</Badge>
              <span className="text-muted">
                from{" "}
                <span className="font-mono">
                  {source?.name ?? "?"}.{sourceRelation?.name ?? "?"}
                </span>
              </span>
              <Badge variant="success">read-only</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

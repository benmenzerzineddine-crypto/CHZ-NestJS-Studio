import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EntityDef } from "@/core/model/schema";

interface EntityOwnershipCardProps {
  entity: EntityDef;
}

export function EntityOwnershipCard({ entity }: EntityOwnershipCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3.5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Ownership</p>
        <p className="mt-1 text-xs text-muted">
          Managed by the access matrix. Owner rules add a many-to-one relation to User.
        </p>
      </div>
      {entity.options.owner ? (
        <Badge variant="accent">
          <Lock className="h-2.5 w-2.5" />
          {entity.options.ownerRelation ?? "owner"}
        </Badge>
      ) : (
        <Badge>off</Badge>
      )}
    </div>
  );
}

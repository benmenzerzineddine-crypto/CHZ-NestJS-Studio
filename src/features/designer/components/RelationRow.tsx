import { ArrowLeft, Link2, Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DerivedInverse } from "@/core/model/normalize";
import type { EntityDef, RelationDef } from "@/core/model/schema";
import { RELATION_LABELS } from "./RelationConstants";

export interface RelationRowProps {
  relation: RelationDef;
  target?: EntityDef;
  inverse?: DerivedInverse;
  ownerManaged: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function RelationRow({
  relation,
  target,
  inverse,
  ownerManaged,
  onEdit,
  onDelete,
}: RelationRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted" />
          <span className="font-mono text-xs text-foreground">{relation.name}</span>
          <Badge variant="accent">{RELATION_LABELS[relation.kind]}</Badge>
          <ArrowLeft className="h-3 w-3 text-muted" />
          <span className="text-sm text-foreground">
            {target?.name ?? "Missing entity"}
          </span>
          {relation.nullable ? <Badge>nullable</Badge> : null}
          {relation.cascade ? <Badge variant="warning">cascade</Badge> : null}
          {ownerManaged ? (
            <Badge variant="accent">
              <Lock className="h-2.5 w-2.5" />
              access-owned
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {inverse && target
            ? `Inverse on ${target.name}: ${inverse.name} (${RELATION_LABELS[inverse.kind]})`
            : "Inverse unavailable while the target is missing."}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Edit ${relation.name}`}
          disabled={ownerManaged}
          title={
            ownerManaged
              ? "The owner relation is managed by the access matrix"
              : undefined
          }
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted hover:text-danger"
          aria-label={`Delete ${relation.name}`}
          disabled={ownerManaged}
          title={
            ownerManaged
              ? "Remove owner-level access rules first"
              : undefined
          }
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

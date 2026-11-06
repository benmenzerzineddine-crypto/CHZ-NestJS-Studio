import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { buildDerivedInverses } from "@/core/model/normalize";
import type { EntityDef, RelationDef } from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { DerivedInversesList } from "./components/DerivedInversesList";
import { RelationDialog } from "./components/RelationDialog";
import { RelationRow } from "./components/RelationRow";

interface RelationsEditorProps {
  entity: EntityDef;
}

export function RelationsEditor({ entity }: RelationsEditorProps) {
  const project = useProjectStore((state) => state.project);
  const deleteRelation = useProjectStore((state) => state.deleteRelation);
  const pushToast = useUiStore((state) => state.pushToast);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RelationDef | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RelationDef | null>(null);

  const inverses = useMemo(
    () => (project ? buildDerivedInverses(project.entities) : []),
    [project],
  );

  const inverseByRelation = useMemo(
    () => new Map(inverses.map((inverse) => [inverse.relationId, inverse])),
    [inverses],
  );

  if (!project) return null;

  const inbound = inverses.filter((inverse) => inverse.targetEntityId === entity.id);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(relation: RelationDef) {
    setEditing(relation);
    setDialogOpen(true);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const deleted = deleteRelation(entity.id, pendingDelete.id);
    if (!deleted) {
      pushToast({
        kind: "warning",
        title: "Relation is managed by the access matrix",
        message: "Remove the owner-level access rules before deleting the owner relation.",
      });
    }
    setPendingDelete(null);
  }

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Relations</h2>
          <p className="mt-0.5 text-xs text-muted">
            Inverses are derived automatically. You never edit both sides.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add relation
        </Button>
      </header>

      {entity.relations.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted">
          No relations yet.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {entity.relations.map((relation) => {
            const target = project.entities.find(
              (candidate) => candidate.id === relation.targetEntityId,
            );
            const inverse = inverseByRelation.get(relation.id);
            const ownerManaged =
              entity.options.owner && entity.options.ownerRelation === relation.name;

            return (
              <RelationRow
                key={relation.id}
                relation={relation}
                target={target}
                inverse={inverse}
                ownerManaged={ownerManaged}
                onEdit={() => openEdit(relation)}
                onDelete={() => setPendingDelete(relation)}
              />
            );
          })}
        </div>
      )}

      <DerivedInversesList inverses={inbound} project={project} />

      <RelationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entity={entity}
        project={project}
        relation={editing}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete relation"
        description={`Remove ${entity.name}.${pendingDelete?.name}? The derived inverse disappears with it.`}
        confirmLabel="Delete relation"
        onConfirm={confirmDelete}
      />
    </section>
  );
}

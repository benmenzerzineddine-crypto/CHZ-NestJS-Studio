import { Boxes, Copy, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BufferedInput } from "@/components/ui/buffered-input";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Textarea } from "@/components/ui/textarea";
import { RESERVED_ENTITY_NAMES, isSystemEntity } from "@/core/model/defaults";
import { toPascalCase, toRestPath } from "@/core/model/naming";
import type { EntityDef } from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

interface EntityHeaderProps {
  entity: EntityDef;
}

export function EntityHeader({ entity }: EntityHeaderProps) {
  const project = useProjectStore((state) => state.project);
  const renameEntity = useProjectStore((state) => state.renameEntity);
  const duplicateEntity = useProjectStore((state) => state.duplicateEntity);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const updateEntityDescription = useProjectStore(
    (state) => state.updateEntityDescription,
  );

  const selectEntity = useUiStore((state) => state.selectEntity);
  const setScreen = useUiStore((state) => state.setScreen);
  const pushToast = useUiStore((state) => state.pushToast);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const system = isSystemEntity(entity);

  function entityNameError(name: string): string | null {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
      return "Use PascalCase, for example BlogPost.";
    }
    if ((RESERVED_ENTITY_NAMES as readonly string[]).includes(name)) {
      return `"${name}" is reserved for generated code.`;
    }
    if (
      project?.entities.some(
        (candidate) =>
          candidate.id !== entity.id &&
          (candidate.name.toLowerCase() === name.toLowerCase() ||
            toRestPath(candidate.name) === toRestPath(name)),
      )
    ) {
      return "Another entity already uses this name or REST path.";
    }
    return null;
  }

  function handleDuplicate() {
    const id = duplicateEntity(entity.id);
    if (!id) return;

    const clone = project?.entities.find((candidate) => candidate.id === id);
    selectEntity(id);
    pushToast({
      kind: "success",
      title: "Entity duplicated",
      message: clone ? `Created ${clone.name}.` : undefined,
    });
  }

  function handleDelete() {
    if (!deleteEntity(entity.id)) return;

    const next = project?.entities.find((candidate) => candidate.id !== entity.id);
    selectEntity(next?.id ?? null);
  }

  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted">
            <Boxes className="h-3.5 w-3.5" />
            Entity
            {system ? <Badge variant="accent">system</Badge> : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {system ? (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {entity.name}
              </h1>
            ) : (
              <BufferedInput
                value={entity.name}
                aria-label="Entity name"
                transform={toPascalCase}
                getError={entityNameError}
                onCommit={(name) => renameEntity(entity.id, name)}
                className="h-10 max-w-sm text-xl font-semibold"
              />
            )}
            <Badge variant="success">/api/{toRestPath(entity.name)}</Badge>
          </div>
          <Textarea
            className="mt-3 max-w-xl"
            rows={2}
            maxLength={300}
            value={entity.description ?? ""}
            placeholder="What does this entity represent?"
            onChange={(event) => updateEntityDescription(entity.id, event.target.value)}
          />
          {system ? (
            <p className="mt-2 text-xs text-muted">
              Built-in account entity. Authentication columns are generated; extra fields are
              allowed.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {!system ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                selectEntity(entity.id);
                setScreen("auth");
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Access
            </Button>
          ) : null}
          {!system ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleDuplicate}>
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${entity.name}?`}
        description="The entity, its fields, and every relation targeting it are removed. This cannot be undone after closing the project."
        confirmLabel="Delete entity"
        onConfirm={handleDelete}
      />
    </header>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESERVED_ENTITY_NAMES } from "@/core/model/defaults";
import { toPascalCase, toRestPath, toTableName } from "@/core/model/naming";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

interface AddEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEntityDialog({ open, onOpenChange }: AddEntityDialogProps) {
  const project = useProjectStore((state) => state.project);
  const addEntity = useProjectStore((state) => state.addEntity);
  const selectEntity = useUiStore((state) => state.selectEntity);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  function submit() {
    if (!project) return;
    const trimmed = name.trim();

    if (!/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) {
      setError("Use PascalCase, for example BlogPost.");
      return;
    }
    if ((RESERVED_ENTITY_NAMES as readonly string[]).includes(trimmed)) {
      setError(`"${trimmed}" is reserved for generated code.`);
      return;
    }
    if (
      project.entities.some(
        (entity) => entity.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setError(`An entity named "${trimmed}" already exists.`);
      return;
    }
    if (project.entities.some((entity) => toRestPath(entity.name) === toRestPath(trimmed))) {
      setError(`The REST path /${toRestPath(trimmed)} is already in use.`);
      return;
    }

    const id = addEntity(trimmed);
    selectEntity(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New entity</DialogTitle>
          <DialogDescription>
            Entities become TypeORM models and REST resources. The built-in User entity is
            already present.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-entity-name">Entity name</Label>
          <Input
            id="new-entity-name"
            value={name}
            placeholder="BlogPost"
            autoFocus
            onChange={(event) => {
              setName(toPascalCase(event.target.value));
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>

        {name ? (
          <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-y-2 rounded-lg border border-border bg-surface-raised/50 px-4 py-3 text-xs">
            <dt className="text-muted">REST path</dt>
            <dd className="font-mono text-foreground">/api/{toRestPath(name)}</dd>
            <dt className="text-muted">Table</dt>
            <dd className="font-mono text-foreground">{toTableName(name)}</dd>
          </dl>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create entity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

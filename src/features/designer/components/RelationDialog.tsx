import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select } from "@/components/ui/select";
import { toCamelCase } from "@/core/model/naming";
import type { EntityDef, Project, RelationDef, RelationKind } from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { CREATABLE_KINDS, RELATION_LABELS } from "./RelationConstants";

export interface RelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EntityDef;
  project: Project;
  relation: RelationDef | null;
}

export function RelationDialog({
  open,
  onOpenChange,
  entity,
  project,
  relation,
}: RelationDialogProps) {
  const addRelation = useProjectStore((state) => state.addRelation);
  const updateRelation = useProjectStore((state) => state.updateRelation);

  const [kind, setKind] = useState<RelationKind>("many-to-one");
  const [targetId, setTargetId] = useState("");
  const [name, setName] = useState("");
  const [nullable, setNullable] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fallbackTarget =
      project.entities.find((candidate) => candidate.id !== entity.id)?.id ?? entity.id;

    setKind(relation?.kind ?? "many-to-one");
    setTargetId(relation?.targetEntityId ?? fallbackTarget);
    setName(relation?.name ?? "");
    setNullable(relation?.nullable ?? false);
    setCascade(relation?.cascade ?? false);
    setError(null);
  }, [open, relation, entity.id, project.entities]);

  const target = project.entities.find((candidate) => candidate.id === targetId);
  const oneToMany = kind === "one-to-many";
  const defaultName = oneToMany
    ? toCamelCase(entity.name)
    : target
      ? toCamelCase(target.name)
      : "";

  function submit() {
    if (!target) {
      setError("Choose a target entity.");
      return;
    }

    const finalName = (name.trim() || defaultName).trim();
    if (!/^[a-z][A-Za-z0-9]*$/.test(finalName)) {
      setError("Use camelCase, for example author.");
      return;
    }

    const holder = oneToMany ? target : entity;
    const duplicateField = holder.fields.some((field) => field.name === finalName);
    const duplicateRelation = holder.relations.some(
      (candidate) =>
        candidate.name === finalName &&
        !(relation !== null && candidate.id === relation.id),
    );

    if (duplicateField || duplicateRelation) {
      setError(`${holder.name} already has a field or relation named "${finalName}".`);
      return;
    }

    if (relation) {
      updateRelation(entity.id, relation.id, { name: finalName, nullable, cascade });
      onOpenChange(false);
      return;
    }

    if (oneToMany) {
      const created = addRelation(target.id, {
        name: finalName,
        targetEntityId: entity.id,
        kind: "many-to-one",
        nullable,
        cascade,
      });
      if (!created) {
        setError("Could not create the relation.");
        return;
      }
    } else {
      const created = addRelation(entity.id, {
        name: finalName,
        targetEntityId: target.id,
        kind,
        nullable,
        cascade,
      });
      if (!created) {
        setError("Could not create the relation.");
        return;
      }
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{relation ? "Edit relation" : "Add relation"}</DialogTitle>
          <DialogDescription>
            {oneToMany
              ? `Stored as a many-to-one on ${target?.name ?? "the target"}; the ${entity.name} side is derived.`
              : "The inverse side is generated from this relation and shown read-only."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="relation-kind">Kind</Label>
            <Select
              id="relation-kind"
              value={kind}
              disabled={relation !== null}
              onChange={(event) => {
                setKind(event.target.value as RelationKind);
                setError(null);
              }}
            >
              {CREATABLE_KINDS.map((option) => (
                <option key={option} value={option}>
                  {RELATION_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="relation-target">Target entity</Label>
            <Select
              id="relation-target"
              value={targetId}
              disabled={relation !== null}
              onChange={(event) => {
                setTargetId(event.target.value);
                setError(null);
              }}
            >
              {project.entities.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.id === entity.id ? " (self)" : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="relation-name">
              {oneToMany
                ? `Foreign key property on ${target?.name ?? "target"}`
                : "Property name"}
            </Label>
            <Input
              id="relation-name"
              value={name}
              placeholder={defaultName || "author"}
              onChange={(event) => {
                setName(toCamelCase(event.target.value));
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <p className="text-[11px] text-muted">
              {oneToMany
                ? `Adds a many-to-one relation on ${target?.name ?? "the target"}. The inverse appears on ${entity.name} automatically.`
                : "Name used for the generated TypeORM property."}
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={nullable}
                onChange={(event) => setNullable(event.target.checked)}
              />
              Nullable
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={cascade}
                onChange={(event) => setCascade(event.target.checked)}
              />
              Cascade
            </label>
          </div>

          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{relation ? "Save relation" : "Add relation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

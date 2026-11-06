import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { isSystemEntity } from "@/core/model/defaults";
import type {
  EntityDef,
  FieldColumn,
  FieldDef,
  FieldType,
  FieldValidators,
} from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { AddFieldDialog } from "./components/AddFieldDialog";
import { FieldDetailsInspector } from "./components/FieldDetailsInspector";
import { FieldTableRow } from "./components/FieldTableRow";

interface FieldsEditorProps {
  entity: EntityDef;
}

export function FieldsEditor({ entity }: FieldsEditorProps) {
  const project = useProjectStore((state) => state.project);
  const addField = useProjectStore((state) => state.addField);
  const updateField = useProjectStore((state) => state.updateField);
  const deleteField = useProjectStore((state) => state.deleteField);
  const moveField = useProjectStore((state) => state.moveField);
  const reorderField = useProjectStore((state) => state.reorderField);

  const selectedFieldId = useUiStore((state) => state.selectedFieldId);
  const selectField = useUiStore((state) => state.selectField);

  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FieldDef | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const currentEntity =
    project?.entities.find((e) => e.id === entity.id) ?? entity;
  const selectedField =
    currentEntity.fields.find((field) => field.id === selectedFieldId) ?? null;

  useEffect(() => {
    if (!selectedFieldId) return;
    const inspector = inspectorRef.current;
    if (inspector && typeof inspector.scrollIntoView === "function") {
      inspector.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedFieldId]);

  if (!project) return null;

  function handleAdd(name: string, type: FieldType) {
    const id = addField(entity.id, name, type);
    if (!id) return;

    const firstEnum = project?.enums[0];
    if (type === "enum" && firstEnum) {
      updateField(entity.id, id, { enumId: firstEnum.id });
    }
    selectField(id);
  }

  function removeField(field: FieldDef) {
    deleteField(entity.id, field.id);
    if (selectedFieldId === field.id) selectField(null);
  }

  function requestDelete(field: FieldDef) {
    const referenced =
      entity.options.searchFields.includes(field.name) ||
      entity.options.sortFields.includes(field.name);

    if (referenced) {
      setPendingDelete(field);
      return;
    }
    removeField(field);
  }

  function update(patch: Partial<FieldDef>) {
    if (!selectedField) return;
    updateField(entity.id, selectedField.id, patch);
  }

  function updateValidators(patch: Partial<FieldValidators>) {
    if (!selectedField) return;
    const next = { ...(selectedField.validators ?? {}), ...patch };
    const hasValue = Object.values(next).some((value) => value !== undefined);
    update({ validators: hasValue ? next : undefined });
  }

  function updateColumn(patch: Partial<FieldColumn>) {
    if (!selectedField) return;
    const next = { ...(selectedField.column ?? {}), ...patch };
    const hasValue = Object.values(next).some((value) => value !== undefined);
    update({ column: hasValue ? next : undefined });
  }

  function changeType(type: FieldType) {
    if (!selectedField) return;
    update({
      type,
      enumId:
        type === "enum"
          ? (selectedField.enumId ?? project?.enums[0]?.id)
          : undefined,
      column:
        type === "string"
          ? { length: selectedField.column?.length ?? 255 }
          : type === "decimal"
            ? {
                precision: selectedField.column?.precision ?? 10,
                scale: selectedField.column?.scale ?? 2,
              }
            : undefined,
      validators: undefined,
      primary:
        type === "uuid" || type === "int" ? selectedField.primary : false,
    });
  }

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Fields</h2>
          <p className="mt-0.5 text-xs text-muted">
            Columns generated on the TypeORM entity. Drag rows to reorder.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </header>

      {entity.fields.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted">No fields yet.</p>
          <p className="mt-1 text-xs text-muted">
            An implicit uuid primary key is added by the generator.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add the first field
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="w-8 py-2 pl-4" aria-label="Reorder" />
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="w-16 py-2 text-center font-medium">Required</th>
                <th className="w-16 py-2 text-center font-medium">Unique</th>
                <th className="w-16 py-2 text-center font-medium">Indexed</th>
                <th className="w-16 py-2 text-center font-medium">Primary</th>
                <th className="w-28 py-2 pr-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entity.fields.map((field, index) => {
                const selected = field.id === selectedFieldId;
                const locked = isSystemEntity(entity) && field.name === "email";
                return (
                  <FieldTableRow
                    key={field.id}
                    field={field}
                    index={index}
                    totalCount={entity.fields.length}
                    selected={selected}
                    locked={locked}
                    isDragging={dragId === field.id}
                    onSelect={() => selectField(field.id)}
                    onMoveUp={() => moveField(entity.id, field.id, -1)}
                    onMoveDown={() => moveField(entity.id, field.id, 1)}
                    onDelete={() => requestDelete(field)}
                    onDragStart={(event) => {
                      setDragId(field.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", field.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const source = dragId ?? event.dataTransfer.getData("text/plain");
                      if (source) reorderField(entity.id, source, index);
                      setDragId(null);
                    }}
                    onDragEnd={() => setDragId(null)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedField ? (
        <FieldDetailsInspector
          entity={entity}
          field={selectedField}
          project={project}
          inspectorRef={inspectorRef}
          onClose={() => selectField(null)}
          onUpdate={update}
          onUpdateColumn={updateColumn}
          onUpdateValidators={updateValidators}
          onChangeType={changeType}
          onDelete={() => requestDelete(selectedField)}
        />
      ) : null}

      <AddFieldDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        entity={entity}
        enums={project.enums}
        onAdd={handleAdd}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete field"
        description={`${pendingDelete?.name} is referenced by the search or sort settings of ${entity.name}. Deleting it also removes those references.`}
        confirmLabel="Delete field"
        onConfirm={() => {
          if (pendingDelete) removeField(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </section>
  );
}

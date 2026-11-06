import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BufferedInput } from "@/components/ui/buffered-input";
import { Button } from "@/components/ui/button";
import type { EnumDef } from "@/core/model/schema";
import { toPascalCase } from "@/core/model/naming";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

interface EnumsEditorProps {
  enumDef: EnumDef;
}

function normalizeEnumValue(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+/, "");
}

export function EnumsEditor({ enumDef }: EnumsEditorProps) {
  const project = useProjectStore((state) => state.project);
  const updateEnum = useProjectStore((state) => state.updateEnum);
  const deleteEnum = useProjectStore((state) => state.deleteEnum);
  const selectEnum = useUiStore((state) => state.selectEnum);
  const pushToast = useUiStore((state) => state.pushToast);

  if (!project) return null;

  const usages = project.entities.flatMap((entity) =>
    entity.fields
      .filter((field) => field.enumId === enumDef.id)
      .map((field) => ({ entity, field })),
  );

  function enumNameError(value: string): string | null {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) {
      return "Use PascalCase, for example PostStatus.";
    }
    if (
      project?.enums.some(
        (candidate) =>
          candidate.id !== enumDef.id && candidate.name.toLowerCase() === value.toLowerCase(),
      )
    ) {
      return "Another enum already uses this name.";
    }
    return null;
  }

  function enumValueError(value: string, index: number): string | null {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
      return "Start with a letter; use letters, digits and underscores.";
    }
    if (
      enumDef.values.some(
        (candidate, candidateIndex) => candidateIndex !== index && candidate === value,
      )
    ) {
      return "Enum values must be unique.";
    }
    return null;
  }

  function addValue() {
    let value = "VALUE";
    let suffix = 2;
    while (enumDef.values.includes(value)) {
      value = `VALUE${suffix}`;
      suffix += 1;
    }
    updateEnum(enumDef.id, (draft) => {
      draft.values.push(value);
    });
  }

  function removeValue(index: number) {
    if (enumDef.values.length <= 1) return;
    updateEnum(enumDef.id, (draft) => {
      draft.values.splice(index, 1);
    });
  }

  function moveValue(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= enumDef.values.length) return;
    updateEnum(enumDef.id, (draft) => {
      const [value] = draft.values.splice(index, 1);
      if (value !== undefined) draft.values.splice(target, 0, value);
    });
  }

  function handleDelete() {
    if (usages.length > 0) {
      pushToast({
        kind: "warning",
        title: "Enum is in use",
        message: "Reassign the fields that use this enum before deleting it.",
      });
      return;
    }
    if (deleteEnum(enumDef.id)) {
      const remaining = project?.enums.filter((candidate) => candidate.id !== enumDef.id) ?? [];
      selectEnum(remaining[0]?.id ?? null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Enum</p>
          <div className="mt-2 flex items-center gap-3">
            <BufferedInput
              value={enumDef.name}
              aria-label="Enum name"
              transform={toPascalCase}
              getError={enumNameError}
              onCommit={(name) =>
                updateEnum(enumDef.id, (draft) => {
                  draft.name = name;
                })
              }
              className="h-10 max-w-sm text-lg font-semibold"
            />
            <Badge>shared</Badge>
          </div>
          <p className="mt-2 text-sm text-muted">
            Used by {usages.length} {usages.length === 1 ? "field" : "fields"}. Values keep their
            order in the generated enum.
          </p>
        </div>
        <Button variant="danger" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </header>

      <section className="rounded-xl border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Values</h2>
            <p className="mt-0.5 text-xs text-muted">
              Identifier-safe, unique, and non-empty.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={addValue}>
            <Plus className="h-3.5 w-3.5" />
            Add value
          </Button>
        </header>

        <div className="divide-y divide-border">
          {enumDef.values.map((value, index) => (
            <div key={`${value}-${index}`} className="flex items-center gap-2 px-4 py-3">
              <span className="w-6 shrink-0 text-center font-mono text-[11px] text-muted">
                {index + 1}
              </span>
              <BufferedInput
                aria-label={`Value ${index + 1}`}
                className="h-8 font-mono text-xs"
                value={value}
                transform={normalizeEnumValue}
                getError={(next) => enumValueError(next, index)}
                onCommit={(next) =>
                  updateEnum(enumDef.id, (draft) => {
                    draft.values[index] = next;
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Move ${value} up`}
                disabled={index === 0}
                onClick={() => moveValue(index, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Move ${value} down`}
                disabled={index === enumDef.values.length - 1}
                onClick={() => moveValue(index, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted hover:text-danger"
                aria-label={`Remove ${value}`}
                disabled={enumDef.values.length <= 1}
                onClick={() => removeValue(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {usages.length > 0 ? (
        <section className="mt-5 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">Used by</h2>
          <ul className="mt-3 space-y-1.5">
            {usages.map(({ entity, field }) => (
              <li key={field.id} className="font-mono text-xs text-muted">
                {entity.name}.{field.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Remove these references before deleting the enum.</p>
        </section>
      ) : null}
    </div>
  );
}

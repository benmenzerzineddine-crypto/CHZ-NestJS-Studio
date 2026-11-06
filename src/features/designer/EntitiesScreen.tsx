import { Boxes, Braces, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSystemEntity } from "@/core/model/defaults";
import { cn } from "@/lib/cn";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { AddEntityDialog } from "./AddEntityDialog";
import { AddEnumDialog } from "./AddEnumDialog";
import { EntityDetail } from "./EntityDetail";
import { EnumsEditor } from "./EnumsEditor";

export function EntitiesScreen() {
  const project = useProjectStore((state) => state.project);
  const tab = useUiStore((state) => state.designerTab);
  const selectedEntityId = useUiStore((state) => state.selectedEntityId);
  const selectedEnumId = useUiStore((state) => state.selectedEnumId);
  const setDesignerTab = useUiStore((state) => state.setDesignerTab);
  const selectEntity = useUiStore((state) => state.selectEntity);
  const selectEnum = useUiStore((state) => state.selectEnum);

  const [query, setQuery] = useState("");
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [addEnumOpen, setAddEnumOpen] = useState(false);

  useEffect(() => {
    if (!project || tab !== "entities") return;
    if (project.entities.some((entity) => entity.id === selectedEntityId)) return;
    selectEntity(project.entities[0]?.id ?? null);
  }, [project, tab, selectedEntityId, selectEntity]);

  useEffect(() => {
    if (!project || tab !== "enums") return;
    if (project.enums.some((enumDef) => enumDef.id === selectedEnumId)) return;
    selectEnum(project.enums[0]?.id ?? null);
  }, [project, tab, selectedEnumId, selectEnum]);

  useEffect(() => {
    if (!project || tab !== "entities") return;
    const list = project.entities.filter((entity) =>
      entity.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    if (list.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      event.preventDefault();
      const index = list.findIndex((entity) => entity.id === selectedEntityId);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = index === -1 ? 0 : (index + delta + list.length) % list.length;
      selectEntity(list[next].id);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [project, tab, query, selectedEntityId, selectEntity]);

  if (!project) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const entities = project.entities.filter((entity) =>
    entity.name.toLowerCase().includes(normalizedQuery),
  );
  const enums = project.enums.filter((enumDef) =>
    enumDef.name.toLowerCase().includes(normalizedQuery),
  );

  const selectedEntity =
    project.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const selectedEnum = project.enums.find((enumDef) => enumDef.id === selectedEnumId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface/40">
        <div className="flex gap-1 border-b border-border p-2">
          <button
            type="button"
            onClick={() => setDesignerTab("entities")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              tab === "entities"
                ? "bg-accent/10 text-foreground"
                : "text-muted hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <Boxes className="h-3.5 w-3.5" />
            Entities
          </button>
          <button
            type="button"
            onClick={() => setDesignerTab("enums")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              tab === "enums"
                ? "bg-accent/10 text-foreground"
                : "text-muted hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <Braces className="h-3.5 w-3.5" />
            Enums
          </button>
        </div>

        <div className="space-y-2 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              className="h-8 pl-8 text-xs"
              value={query}
              placeholder={tab === "entities" ? "Search entities…" : "Search enums…"}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button
            className="w-full"
            size="sm"
            onClick={() => {
              if (tab === "entities") setAddEntityOpen(true);
              else setAddEnumOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New {tab === "entities" ? "entity" : "enum"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
          {tab === "entities" ? (
            entities.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted">No entities match.</p>
            ) : (
              <div className="space-y-0.5">
                {entities.map((entity) => {
                  const active = entity.id === selectedEntityId;
                  return (
                    <button
                      key={entity.id}
                      type="button"
                      onClick={() => selectEntity(entity.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                        active
                          ? "bg-accent/10 text-foreground"
                          : "text-muted hover:bg-surface-raised hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{entity.name}</span>
                        {isSystemEntity(entity) ? (
                          <Badge variant="accent">system</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {entity.fields.length} fields · {entity.relations.length} relations
                      </p>
                    </button>
                  );
                })}
              </div>
            )
          ) : enums.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted">
              No enums yet. Create one to use with enum fields.
            </p>
          ) : (
            <div className="space-y-0.5">
              {enums.map((enumDef) => {
                const usage = project.entities.reduce(
                  (count, entity) =>
                    count + entity.fields.filter((field) => field.enumId === enumDef.id).length,
                  0,
                );
                const active = enumDef.id === selectedEnumId;
                return (
                  <button
                    key={enumDef.id}
                    type="button"
                    onClick={() => selectEnum(enumDef.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                      active
                        ? "bg-accent/10 text-foreground"
                        : "text-muted hover:bg-surface-raised hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{enumDef.name}</span>
                      {usage === 0 ? <Badge variant="warning">unused</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {enumDef.values.length} values · {usage} fields
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
        {tab === "entities" ? (
          selectedEntity ? (
            <EntityDetail key={selectedEntity.id} entity={selectedEntity} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <p className="text-sm text-muted">Select an entity to edit it.</p>
                <Button className="mt-4" size="sm" onClick={() => setAddEntityOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New entity
                </Button>
              </div>
            </div>
          )
        ) : selectedEnum ? (
          <EnumsEditor key={selectedEnum.id} enumDef={selectedEnum} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-sm text-muted">No enums yet.</p>
              <Button className="mt-4" size="sm" onClick={() => setAddEnumOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                New enum
              </Button>
            </div>
          </div>
        )}
      </section>

      <AddEntityDialog open={addEntityOpen} onOpenChange={setAddEntityOpen} />
      <AddEnumDialog open={addEnumOpen} onOpenChange={setAddEnumOpen} />
    </div>
  );
}

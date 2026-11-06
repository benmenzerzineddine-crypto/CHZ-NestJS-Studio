import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { EntityDef } from "@/core/model/schema";
import { cn } from "@/lib/cn";
import { useProjectStore } from "@/store/project.store";

interface EntitySearchSortCardProps {
  entity: EntityDef;
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border bg-surface-raised text-muted hover:text-foreground",
      )}
    >
      {active ? <Check className="h-3 w-3" /> : null}
      <span className="font-mono">{children}</span>
    </button>
  );
}

export function EntitySearchSortCard({ entity }: EntitySearchSortCardProps) {
  const updateEntityOptions = useProjectStore((state) => state.updateEntityOptions);

  const searchable = entity.fields.filter(
    (field) => field.type === "string" || field.type === "text",
  );
  const sortable = entity.fields.filter((field) => field.type !== "json");

  function toggleSearch(name: string) {
    const active = entity.options.searchFields.includes(name);
    updateEntityOptions(entity.id, {
      searchFields: active
        ? entity.options.searchFields.filter((field) => field !== name)
        : [...entity.options.searchFields, name],
    });
  }

  function toggleSort(name: string) {
    const active = entity.options.sortFields.includes(name);
    updateEntityOptions(entity.id, {
      sortFields: active
        ? entity.options.sortFields.filter((field) => field !== name)
        : [...entity.options.sortFields, name],
    });
  }

  return (
    <div className="grid gap-5 border-t border-border p-5 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Search fields
          </p>
          <span className="text-[11px] text-muted">string / text fields</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {searchable.length === 0 ? (
            <p className="text-xs text-muted">
              Add a string or text field to enable searching.
            </p>
          ) : (
            searchable.map((field) => (
              <Chip
                key={field.id}
                active={entity.options.searchFields.includes(field.name)}
                onClick={() => toggleSearch(field.name)}
              >
                {field.name}
              </Chip>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Sort fields
          </p>
          <span className="text-[11px] text-muted">scalar fields</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sortable.length === 0 ? (
            <p className="text-xs text-muted">Add a field to enable sorting.</p>
          ) : (
            sortable.map((field) => (
              <Chip
                key={field.id}
                active={entity.options.sortFields.includes(field.name)}
                onClick={() => toggleSort(field.name)}
              >
                {field.name}
              </Chip>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

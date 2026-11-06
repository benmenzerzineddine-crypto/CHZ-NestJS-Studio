import { ToggleRow } from "@/components/ui/form-row";
import { isSystemEntity } from "@/core/model/defaults";
import type { EntityDef } from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";

interface EntityOptionsCardProps {
  entity: EntityDef;
}

export function EntityOptionsCard({ entity }: EntityOptionsCardProps) {
  const updateEntityOptions = useProjectStore((state) => state.updateEntityOptions);
  const system = isSystemEntity(entity);

  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <ToggleRow
        variant="card"
        label="Timestamps"
        hint="createdAt and updatedAt columns"
        checked={entity.options.timestamps}
        onCheckedChange={(timestamps) => updateEntityOptions(entity.id, { timestamps })}
      />
      <ToggleRow
        variant="card"
        label="Soft delete"
        hint="deletedAt column and restore route"
        checked={entity.options.softDelete}
        onCheckedChange={(softDelete) => updateEntityOptions(entity.id, { softDelete })}
      />
      <ToggleRow
        variant="card"
        label="Pagination"
        hint="page, limit and total meta on list"
        checked={entity.options.pagination}
        onCheckedChange={(pagination) => updateEntityOptions(entity.id, { pagination })}
      />
      {!system ? (
        <ToggleRow
          variant="card"
          label="Multi-tenant"
          hint="Scope records by tenant header"
          checked={entity.options.multitenant ?? false}
          onCheckedChange={(multitenant) => updateEntityOptions(entity.id, { multitenant })}
        />
      ) : null}
    </div>
  );
}

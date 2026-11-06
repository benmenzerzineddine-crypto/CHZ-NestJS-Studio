import type { EntityDef } from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { CustomEndpointsEditor } from "./CustomEndpointsEditor";
import { FieldsEditor } from "./FieldsEditor";
import { RelationsEditor } from "./RelationsEditor";
import { EntityHeader } from "./components/EntityHeader";
import { EntityOptionsCard } from "./components/EntityOptionsCard";
import { EntityOwnershipCard } from "./components/EntityOwnershipCard";
import { EntityPerformanceCard } from "./components/EntityPerformanceCard";
import { EntitySearchSortCard } from "./components/EntitySearchSortCard";

interface EntityDetailProps {
  entity: EntityDef;
}

export function EntityDetail({ entity }: EntityDetailProps) {
  const project = useProjectStore((state) => state.project);

  if (!project) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-8">
      <EntityHeader entity={entity} />

      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-surface">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Options</h2>
            <p className="mt-0.5 text-xs text-muted">
              CRUD behaviour, list querying and ownership.
            </p>
          </header>

          <EntityOptionsCard entity={entity} />
          <EntitySearchSortCard entity={entity} />
          <EntityOwnershipCard entity={entity} />
          <EntityPerformanceCard entity={entity} />
        </section>

        <FieldsEditor entity={entity} />
        <RelationsEditor entity={entity} />
        <CustomEndpointsEditor entity={entity} />
      </div>
    </div>
  );
}

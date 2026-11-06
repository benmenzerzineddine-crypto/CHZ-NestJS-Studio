import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/project.store";
import { EndpointsFilterHeader } from "./components/EndpointsFilterHeader";
import { EntityRouteGroupCard } from "./components/EntityRouteGroupCard";
import { SystemRoutesCard } from "./components/SystemRoutesCard";
import { buildEntityRouteGroups, buildSystemRoutes } from "./route-builder";

export function EndpointsScreen() {
  const project = useProjectStore((state) => state.project);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    if (!project) return [];
    return buildEntityRouteGroups(project, query);
  }, [project, query]);

  const systemRoutes = useMemo(() => {
    if (!project) return [];
    return buildSystemRoutes(project);
  }, [project]);

  if (!project) return null;

  const showSystem = query.trim().length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <EndpointsFilterHeader query={query} onQueryChange={setQuery} />

      <div className="space-y-5">
        {showSystem ? <SystemRoutesCard routes={systemRoutes} /> : null}

        {groups.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-12 text-center">
            <p className="text-sm text-muted">
              {query.trim() ? "No entities match that filter." : "No entities yet."}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <EntityRouteGroupCard
              key={group.name}
              group={group}
              tenantHeader={project.settings.multitenancy.header}
            />
          ))
        )}

        {!project.auth.enabled ? (
          <p className="text-xs text-muted">
            Authentication is disabled: auth and admin user routes are not generated.
          </p>
        ) : null}

        {project.entities.length <= 1 ? (
          <p className="text-xs text-muted">
            Create entities in the designer to populate this route table.
          </p>
        ) : null}
      </div>
    </div>
  );
}

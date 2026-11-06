import { Badge } from "@/components/ui/badge";
import type { RouteGroup } from "../types";
import { RouteTable } from "./RouteTable";

export interface EntityRouteGroupCardProps {
  group: RouteGroup;
  tenantHeader?: string;
}

export function EntityRouteGroupCard({
  group,
  tenantHeader,
}: EntityRouteGroupCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{group.name}</h2>
            {group.multitenant && tenantHeader && (
              <Badge variant="accent">
                Multi-tenant ({tenantHeader})
              </Badge>
            )}
            {group.throttle && (
              <Badge variant="default">Rate: {group.throttle}</Badge>
            )}
            {group.cache && (
              <Badge variant="accent">Cache: {group.cache}</Badge>
            )}
          </div>
          <p className="truncate font-mono text-[11px] text-muted">{group.path}</p>
        </div>
        <Badge>{group.routes.length} routes</Badge>
      </header>
      <RouteTable routes={group.routes} />
    </section>
  );
}

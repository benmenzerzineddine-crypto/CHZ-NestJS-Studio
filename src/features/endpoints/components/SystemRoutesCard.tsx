import { Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RouteEntry } from "../types";
import { RouteTable } from "./RouteTable";

export interface SystemRoutesCardProps {
  routes: RouteEntry[];
}

export function SystemRoutesCard({ routes }: SystemRoutesCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Route className="h-3.5 w-3.5 text-muted" />
        <h2 className="text-sm font-semibold text-foreground">Auth &amp; system</h2>
        <Badge>{routes.length} routes</Badge>
      </header>
      <RouteTable routes={routes} />
    </section>
  );
}

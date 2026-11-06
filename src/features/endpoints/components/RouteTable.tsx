import { Badge } from "@/components/ui/badge";
import { MethodBadge } from "@/components/ui/method-badge";
import { ACCESS_LABELS, ACCESS_VARIANTS, type RouteEntry } from "../types";

export interface RouteTableProps {
  routes: RouteEntry[];
}

export function RouteTable({ routes }: RouteTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted">
            <th className="w-20 py-2 pl-5 font-medium">Method</th>
            <th className="py-2 pr-3 font-medium">Path</th>
            <th className="w-40 py-2 pr-5 font-medium">Access</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={`${route.method}-${route.path}`} className="border-t border-border">
              <td className="py-2.5 pl-5">
                <MethodBadge method={route.method} />
              </td>
              <td className="py-2.5 pr-3">
                <span className="font-mono text-xs text-foreground">{route.path}</span>
                {route.isCustom ? (
                  <Badge variant="accent" className="ml-2 text-[10px]">
                    Custom
                  </Badge>
                ) : null}
                {route.throttle ? (
                  <Badge
                    variant={route.throttle === "exempt" ? "warning" : "default"}
                    className="ml-2 text-[10px]"
                  >
                    {route.throttle === "exempt" ? "No throttle" : `Rate: ${route.throttle}`}
                  </Badge>
                ) : null}
                {route.cache ? (
                  <Badge variant="accent" className="ml-2 text-[10px]">
                    Cache: {route.cache}
                  </Badge>
                ) : null}
                {route.note ? (
                  <span className="ml-2 text-[11px] text-muted">{route.note}</span>
                ) : null}
              </td>
              <td className="py-2.5 pr-5">
                <Badge variant={ACCESS_VARIANTS[route.access]}>
                  {ACCESS_LABELS[route.access]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface EndpointsFilterHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function EndpointsFilterHeader({
  query,
  onQueryChange,
}: EndpointsFilterHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Endpoints</h1>
        <p className="mt-1 text-sm text-muted">
          Read-only route review derived from the model, access matrix, and custom endpoints.
        </p>
      </div>
      <div className="relative w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <Input
          className="h-9 pl-8 text-xs"
          value={query}
          placeholder="Filter by entity…"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
    </header>
  );
}

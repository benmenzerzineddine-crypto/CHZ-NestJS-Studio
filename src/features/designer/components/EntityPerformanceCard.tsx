import { ToggleRow } from "@/components/ui/form-row";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { isSystemEntity } from "@/core/model/defaults";
import type { EntityDef } from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";

interface EntityPerformanceCardProps {
  entity: EntityDef;
}

export function EntityPerformanceCard({ entity }: EntityPerformanceCardProps) {
  const updateEntityOptions = useProjectStore((state) => state.updateEntityOptions);
  const system = isSystemEntity(entity);

  if (system) return null;

  return (
    <div className="border-t border-border p-5 space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Rate Limiting & Cache Hints
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Endpoint-level overrides for controller request throttling and response caching headers.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          variant="card"
          label="Rate Limit Override"
          hint="Custom request quota for this entity's routes"
          checked={entity.options.throttle !== undefined}
          onCheckedChange={(checked) =>
            updateEntityOptions(entity.id, {
              throttle: checked ? { limit: 20, ttl: 60 } : undefined,
            })
          }
        />
        <ToggleRow
          variant="card"
          label="Response Cache Hints"
          hint="Add Cache-Control headers to read operations"
          checked={entity.options.cache !== undefined}
          onCheckedChange={(checked) =>
            updateEntityOptions(entity.id, {
              cache: checked ? { maxAge: 60, scope: "public" } : undefined,
            })
          }
        />
      </div>

      {entity.options.throttle !== undefined ? (
        <div className="rounded-lg border border-border bg-surface-raised/30 p-3.5 space-y-3">
          <p className="text-xs font-semibold text-foreground">Rate Limit Configuration</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">Limit (requests)</label>
              <NumberInput
                min={1}
                max={100000}
                value={entity.options.throttle.limit}
                onChange={(val) => {
                  if (val !== undefined) {
                    updateEntityOptions(entity.id, {
                      throttle: { ...entity.options.throttle!, limit: Math.max(1, val) },
                    });
                  }
                }}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">Window (seconds)</label>
              <NumberInput
                min={1}
                max={3600}
                value={entity.options.throttle.ttl}
                onChange={(val) => {
                  if (val !== undefined) {
                    updateEntityOptions(entity.id, {
                      throttle: { ...entity.options.throttle!, ttl: Math.max(1, val) },
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {entity.options.cache !== undefined ? (
        <div className="rounded-lg border border-border bg-surface-raised/30 p-3.5 space-y-3">
          <p className="text-xs font-semibold text-foreground">Cache-Control Configuration (GET operations)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">Max Age (seconds)</label>
              <NumberInput
                min={0}
                max={31536000}
                value={entity.options.cache.maxAge}
                onChange={(val) => {
                  if (val !== undefined) {
                    updateEntityOptions(entity.id, {
                      cache: { ...entity.options.cache!, maxAge: Math.max(0, val) },
                    });
                  }
                }}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">Scope</label>
              <Select
                value={entity.options.cache.scope}
                onChange={(e) => {
                  updateEntityOptions(entity.id, {
                    cache: {
                      ...entity.options.cache!,
                      scope: e.target.value as "public" | "private" | "no-cache" | "no-store",
                    },
                  });
                }}
              >
                <option value="public">public</option>
                <option value="private">private</option>
                <option value="no-cache">no-cache</option>
                <option value="no-store">no-store</option>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">Shared Max Age (s-maxage)</label>
              <NumberInput
                min={0}
                max={31536000}
                placeholder="Optional"
                value={entity.options.cache.sharedMaxAge ?? ""}
                onChange={(val) => {
                  updateEntityOptions(entity.id, {
                    cache: {
                      ...entity.options.cache!,
                      sharedMaxAge: val !== undefined ? Math.max(0, val) : undefined,
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";

export type CacheScope = "public" | "private" | "no-cache" | "no-store";

export interface EndpointCacheSectionProps {
  enableCache: boolean;
  onEnableCacheChange: (enabled: boolean) => void;
  cacheMaxAge: number;
  onCacheMaxAgeChange: (maxAge: number) => void;
  cacheScope: CacheScope;
  onCacheScopeChange: (scope: CacheScope) => void;
  cacheSharedMaxAge: string;
  onCacheSharedMaxAgeChange: (sharedMaxAge: string) => void;
}

export function EndpointCacheSection({
  enableCache,
  onEnableCacheChange,
  cacheMaxAge,
  onCacheMaxAgeChange,
  cacheScope,
  onCacheScopeChange,
  cacheSharedMaxAge,
  onCacheSharedMaxAgeChange,
}: EndpointCacheSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">HTTP Cache-Control</Label>
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
          <Checkbox checked={enableCache} onChange={() => onEnableCacheChange(!enableCache)} />
          <span>Enable cache header</span>
        </label>
      </div>

      {enableCache ? (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <Label className="text-[11px] text-muted">Max Age (s)</Label>
            <NumberInput
              min={0}
              max={31536000}
              value={cacheMaxAge}
              onChange={(val) => onCacheMaxAgeChange(val ?? 0)}
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted">Scope</Label>
            <Select
              value={cacheScope}
              onChange={(e) => onCacheScopeChange(e.target.value as CacheScope)}
              className="mt-1 w-full text-xs"
            >
              <option value="public">public</option>
              <option value="private">private</option>
              <option value="no-cache">no-cache</option>
              <option value="no-store">no-store</option>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted">Shared Max Age (s)</Label>
            <NumberInput
              min={0}
              max={31536000}
              placeholder="Optional"
              value={cacheSharedMaxAge}
              onChange={(val) => onCacheSharedMaxAgeChange(val !== undefined ? String(val) : "")}
              className="mt-1 text-xs"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

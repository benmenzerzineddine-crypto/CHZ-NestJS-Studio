import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type ThrottleMode = "default" | "custom" | "skip";

export interface EndpointThrottleSectionProps {
  throttleMode: ThrottleMode;
  onThrottleModeChange: (mode: ThrottleMode) => void;
  throttleLimit: number;
  onThrottleLimitChange: (limit: number) => void;
  throttleTtl: number;
  onThrottleTtlChange: (ttl: number) => void;
}

export function EndpointThrottleSection({
  throttleMode,
  onThrottleModeChange,
  throttleLimit,
  onThrottleLimitChange,
  throttleTtl,
  onThrottleTtlChange,
}: EndpointThrottleSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised/30 p-3 space-y-3">
      <Label className="text-xs font-semibold">Rate Limiting</Label>
      <Select
        value={throttleMode}
        onChange={(e) => onThrottleModeChange(e.target.value as ThrottleMode)}
        className="w-full text-xs"
      >
        <option value="default">Default (inherit project rate limits)</option>
        <option value="custom">Custom rate limit</option>
        <option value="skip">Skip rate limiting (exempt)</option>
      </Select>

      {throttleMode === "custom" ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <Label className="text-[11px] text-muted">Limit (requests)</Label>
            <Input
              type="number"
              min={1}
              max={100000}
              value={throttleLimit}
              onChange={(e) => onThrottleLimitChange(Number.parseInt(e.target.value, 10) || 1)}
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted">Window (seconds)</Label>
            <Input
              type="number"
              min={1}
              max={3600}
              value={throttleTtl}
              onChange={(e) => onThrottleTtlChange(Number.parseInt(e.target.value, 10) || 1)}
              className="mt-1 text-xs"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import type { Project } from "@/core/model/schema";

export interface ThrottlingSettingsSectionProps {
  throttling?: Project["settings"]["throttling"];
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function ThrottlingSettingsSection({
  throttling,
  onUpdate,
}: ThrottlingSettingsSectionProps) {
  return (
    <CardSection
      title="Rate Limiting"
      description="Global rate limiting defaults powered by @nestjs/throttler."
    >
      <ToggleRow
        label="Enable rate limiting"
        hint="Guard the API against high-frequency abuse with global request quotas."
        checked={throttling?.enabled ?? true}
        onCheckedChange={(checked) =>
          onUpdate((draft) => {
            if (!draft.settings.throttling) {
              draft.settings.throttling = {
                enabled: true,
                ttl: 60,
                limit: 100,
              };
            }
            draft.settings.throttling.enabled = checked;
          })
        }
      />
      {(throttling?.enabled ?? true) && (
        <>
          <FormRow
            label="Time-to-live (seconds)"
            hint="Sliding window duration for the request quota."
            htmlFor="settings-throttle-ttl"
          >
            <Input
              id="settings-throttle-ttl"
              type="number"
              min={1}
              max={3600}
              value={throttling?.ttl ?? 60}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isNaN(parsed)) {
                  onUpdate((draft) => {
                    if (!draft.settings.throttling) {
                      draft.settings.throttling = { enabled: true, ttl: 60, limit: 100 };
                    }
                    draft.settings.throttling.ttl = Math.max(1, Math.min(3600, parsed));
                  });
                }
              }}
            />
          </FormRow>
          <FormRow
            label="Request limit"
            hint="Maximum number of requests permitted within the TTL window."
            htmlFor="settings-throttle-limit"
          >
            <Input
              id="settings-throttle-limit"
              type="number"
              min={1}
              max={100000}
              value={throttling?.limit ?? 100}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isNaN(parsed)) {
                  onUpdate((draft) => {
                    if (!draft.settings.throttling) {
                      draft.settings.throttling = { enabled: true, ttl: 60, limit: 100 };
                    }
                    draft.settings.throttling.limit = Math.max(1, Math.min(100000, parsed));
                  });
                }
              }}
            />
          </FormRow>
        </>
      )}
    </CardSection>
  );
}

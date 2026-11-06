import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import type { Project } from "@/core/model/schema";

export interface MultitenancySettingsSectionProps {
  multitenancy?: Project["settings"]["multitenancy"];
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function MultitenancySettingsSection({
  multitenancy,
  onUpdate,
}: MultitenancySettingsSectionProps) {
  return (
    <CardSection
      title="Multi-tenancy"
      description="Tenant isolation with header resolution and automatic query scoping."
    >
      <ToggleRow
        label="Enable Multi-tenancy"
        hint="Enforce tenant isolation on entities marked as multi-tenant."
        checked={multitenancy?.enabled ?? false}
        onCheckedChange={(checked) =>
          onUpdate((draft) => {
            if (!draft.settings.multitenancy) {
              draft.settings.multitenancy = {
                enabled: false,
                header: "x-tenant-id",
              };
            }
            draft.settings.multitenancy.enabled = checked;
          })
        }
      />
      {multitenancy?.enabled && (
        <FormRow
          label="Tenant header"
          hint="HTTP header inspected for the tenant identifier."
          htmlFor="settings-tenant-header"
        >
          <Input
            id="settings-tenant-header"
            value={multitenancy.header}
            maxLength={60}
            onChange={(event) =>
              onUpdate((draft) => {
                if (!draft.settings.multitenancy) {
                  draft.settings.multitenancy = {
                    enabled: true,
                    header: "x-tenant-id",
                  };
                }
                draft.settings.multitenancy.header = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
              })
            }
            onBlur={() => {
              if (!multitenancy.header.trim()) {
                onUpdate((draft) => {
                  if (draft.settings.multitenancy) {
                    draft.settings.multitenancy.header = "x-tenant-id";
                  }
                });
              }
            }}
          />
        </FormRow>
      )}
    </CardSection>
  );
}

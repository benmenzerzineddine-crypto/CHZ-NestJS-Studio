import { CardSection } from "@/components/ui/card-section";
import { FormRow } from "@/components/ui/form-row";
import { Select } from "@/components/ui/select";
import type { Driver, Project } from "@/core/model/schema";
import { DRIVER_OPTIONS } from "@/lib/drivers";

export interface DatabaseSettingsSectionProps {
  driver: Driver;
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function DatabaseSettingsSection({
  driver,
  onUpdate,
}: DatabaseSettingsSectionProps) {
  return (
    <CardSection
      title="Database"
      description="TypeORM driver used by the generated API."
    >
      <FormRow label="Driver" hint="PostgreSQL is the golden path." htmlFor="settings-driver">
        <Select
          id="settings-driver"
          value={driver}
          onChange={(event) =>
            onUpdate((draft) => {
              draft.driver = event.target.value as Driver;
            })
          }
        >
          {DRIVER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormRow>
    </CardSection>
  );
}

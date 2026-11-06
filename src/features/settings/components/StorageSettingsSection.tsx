import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import type { Project, StorageDriver } from "@/core/model/schema";

export interface StorageSettingsSectionProps {
  uploads?: Project["settings"]["uploads"];
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function StorageSettingsSection({
  uploads,
  onUpdate,
}: StorageSettingsSectionProps) {
  return (
    <CardSection
      title="File Uploads"
      description="Multipart file uploads, metadata tracking, and object storage."
    >
      <ToggleRow
        label="Attachments"
        hint="Generate /attachments endpoints, Attachment entity, and storage driver."
        checked={uploads?.enabled ?? false}
        onCheckedChange={(checked) =>
          onUpdate((draft) => {
            if (!draft.settings.uploads) {
              draft.settings.uploads = {
                enabled: false,
                driver: "local",
                maxFileSizeMb: 10,
              };
            }
            draft.settings.uploads.enabled = checked;
          })
        }
      />
      {uploads?.enabled && (
        <>
          <FormRow
            label="Storage driver"
            hint="Store files on local filesystem or S3-compatible bucket."
            htmlFor="settings-upload-driver"
          >
            <Select
              id="settings-upload-driver"
              value={uploads.driver}
              onChange={(event) =>
                onUpdate((draft) => {
                  if (draft.settings.uploads) {
                    draft.settings.uploads.driver = event.target.value as StorageDriver;
                  }
                })
              }
            >
              <option value="local">Local Disk</option>
              <option value="s3">S3 / MinIO / Cloudflare R2</option>
            </Select>
          </FormRow>
          <FormRow
            label="Max file size (MB)"
            hint="Maximum allowed file size in megabytes (1 to 500 MB)."
            htmlFor="settings-upload-max-size"
          >
            <NumberInput
              id="settings-upload-max-size"
              min={1}
              max={500}
              value={uploads.maxFileSizeMb}
              onChange={(val) => {
                if (val !== undefined) {
                  onUpdate((draft) => {
                    if (draft.settings.uploads) {
                      draft.settings.uploads.maxFileSizeMb = Math.max(1, Math.min(500, val));
                    }
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

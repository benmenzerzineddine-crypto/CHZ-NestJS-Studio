import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import type { Project } from "@/core/model/schema";

export interface ProjectSettingsSectionProps {
  project: Project;
  onUpdate: (updater: (draft: Project) => void) => void;
  children?: React.ReactNode;
}

export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+/, "");
}

export function ProjectSettingsSection({
  project,
  onUpdate,
  children,
}: ProjectSettingsSectionProps) {
  return (
    <>
      <CardSection
        title="General"
        description="Identity of the generated NestJS project."
      >
        <FormRow label="Project name" hint="Shown in the studio only." htmlFor="settings-name">
          <Input
            id="settings-name"
            value={project.name}
            maxLength={80}
            onChange={(event) =>
              onUpdate((draft) => {
                draft.name = event.target.value;
              })
            }
            onBlur={() => {
              if (!project.name.trim()) {
                onUpdate((draft) => {
                  draft.name = "Untitled API";
                });
              }
            }}
          />
        </FormRow>
        <FormRow
          label="Package name"
          hint="Used for package.json and the Docker image."
          htmlFor="settings-package"
        >
          <Input
            id="settings-package"
            value={project.packageName}
            maxLength={80}
            onChange={(event) =>
              onUpdate((draft) => {
                draft.packageName = sanitizeSlug(event.target.value);
              })
            }
            onBlur={() => {
              if (!project.packageName) {
                onUpdate((draft) => {
                  draft.packageName = "my-api";
                });
              }
            }}
          />
        </FormRow>
      </CardSection>

      {children}

      <CardSection title="API" description="Routing and documentation.">
        <FormRow
          label="API prefix"
          hint={`Routes will be served under /${project.settings.apiPrefix || "api"}.`}
          htmlFor="settings-prefix"
        >
          <Input
            id="settings-prefix"
            value={project.settings.apiPrefix}
            maxLength={40}
            onChange={(event) =>
              onUpdate((draft) => {
                draft.settings.apiPrefix = sanitizeSlug(event.target.value).slice(0, 40);
              })
            }
            onBlur={() => {
              if (!project.settings.apiPrefix) {
                onUpdate((draft) => {
                  draft.settings.apiPrefix = "api";
                });
              }
            }}
          />
        </FormRow>
        <ToggleRow
          label="Swagger"
          hint="Expose OpenAPI documentation and the Swagger UI."
          checked={project.settings.swagger}
          onCheckedChange={(checked) =>
            onUpdate((draft) => {
              draft.settings.swagger = checked;
            })
          }
        />
      </CardSection>

      <CardSection title="Tooling" description="Extra files in the exported project.">
        <ToggleRow
          label="Docker"
          hint="Emit a Dockerfile and docker-compose.yml with the selected database."
          checked={project.settings.docker}
          onCheckedChange={(checked) =>
            onUpdate((draft) => {
              draft.settings.docker = checked;
            })
          }
        />
        <ToggleRow
          label="Tests"
          hint="Emit e2e specs covering auth, authorization and CRUD."
          checked={project.settings.tests}
          onCheckedChange={(checked) =>
            onUpdate((draft) => {
              draft.settings.tests = checked;
            })
          }
        />
      </CardSection>

      <CardSection
        title="Authentication"
        description="JWT auth, roles and ownership rules."
      >
        <ToggleRow
          label="Enabled"
          hint="Token lifetimes, roles and the access matrix are configured in the Auth step."
          checked={project.auth.enabled}
          onCheckedChange={(checked) =>
            onUpdate((draft) => {
              draft.auth.enabled = checked;
            })
          }
        />
      </CardSection>
    </>
  );
}

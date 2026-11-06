import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import type { Project } from "@/core/model/schema";

export interface GraphQLSettingsSectionProps {
  graphql?: Project["settings"]["graphql"];
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function GraphQLSettingsSection({
  graphql,
  onUpdate,
}: GraphQLSettingsSectionProps) {
  return (
    <CardSection
      title="GraphQL API"
      description="Code-first GraphQL schema and resolver code generation."
    >
      <ToggleRow
        label="GraphQL"
        hint="Generate GraphQL ObjectTypes, inputs, resolvers and Apollo driver."
        checked={graphql?.enabled ?? false}
        onCheckedChange={(checked) =>
          onUpdate((draft) => {
            if (!draft.settings.graphql) {
              draft.settings.graphql = {
                enabled: false,
                playground: true,
                path: "/graphql",
              };
            }
            draft.settings.graphql.enabled = checked;
          })
        }
      />
      {graphql?.enabled && (
        <>
          <ToggleRow
            label="Playground"
            hint="Enable interactive GraphQL playground IDE in development."
            checked={graphql.playground}
            onCheckedChange={(checked) =>
              onUpdate((draft) => {
                if (draft.settings.graphql) {
                  draft.settings.graphql.playground = checked;
                }
              })
            }
          />
          <FormRow
            label="GraphQL path"
            hint="Endpoint path for GraphQL queries and mutations."
            htmlFor="settings-graphql-path"
          >
            <Input
              id="settings-graphql-path"
              value={graphql.path}
              maxLength={100}
              onChange={(event) =>
                onUpdate((draft) => {
                  if (draft.settings.graphql) {
                    draft.settings.graphql.path = event.target.value.trim() || "/graphql";
                  }
                })
              }
            />
          </FormRow>
        </>
      )}
    </CardSection>
  );
}

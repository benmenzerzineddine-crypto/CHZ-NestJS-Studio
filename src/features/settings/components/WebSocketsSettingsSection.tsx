import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { defaultWebSockets } from "@/core/model/defaults";
import type { Project } from "@/core/model/schema";

export interface WebSocketsSettingsSectionProps {
  websockets?: Project["settings"]["websockets"];
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function WebSocketsSettingsSection({
  websockets,
  onUpdate,
}: WebSocketsSettingsSectionProps) {
  const isEnabled = websockets?.enabled ?? false;

  return (
    <CardSection
      title="Real-Time WebSockets (Socket.IO)"
      description="Real-time event gateway, room scoping (user/tenant), and CRUD event broadcasting."
    >
      <ToggleRow
        label="WebSockets"
        hint="Generate Socket.IO EventsGateway, room subscriptions, and real-time event broadcasting."
        checked={isEnabled}
        onCheckedChange={(checked) =>
          onUpdate((draft) => {
            if (!draft.settings.websockets) {
              draft.settings.websockets = defaultWebSockets();
            }
            draft.settings.websockets.enabled = checked;
          })
        }
      />

      {isEnabled && websockets && (
        <>
          <FormRow
            label="Gateway path"
            hint="WebSocket namespace path (e.g. /events)."
            htmlFor="settings-ws-path"
          >
            <Input
              id="settings-ws-path"
              value={websockets.path}
              placeholder="/events"
              maxLength={100}
              onChange={(e) =>
                onUpdate((draft) => {
                  if (draft.settings.websockets) {
                    draft.settings.websockets.path = e.target.value.trim() || "/events";
                  }
                })
              }
            />
          </FormRow>

          <FormRow
            label="CORS origin"
            hint="Allowed WebSocket origins (* or domain)."
            htmlFor="settings-ws-cors"
          >
            <Input
              id="settings-ws-cors"
              value={websockets.corsOrigin}
              placeholder="*"
              maxLength={120}
              onChange={(e) =>
                onUpdate((draft) => {
                  if (draft.settings.websockets) {
                    draft.settings.websockets.corsOrigin = e.target.value.trim() || "*";
                  }
                })
              }
            />
          </FormRow>

          <ToggleRow
            label="JWT Authentication"
            hint="Validate JWT access tokens on connection handshake (auth.token or query param)."
            checked={websockets.auth}
            onCheckedChange={(checked) =>
              onUpdate((draft) => {
                if (draft.settings.websockets) {
                  draft.settings.websockets.auth = checked;
                }
              })
            }
          />

          <ToggleRow
            label="Broadcast CRUD Events"
            hint="Automatically emit created, updated, and deleted events from entity services."
            checked={websockets.broadcastCrud}
            onCheckedChange={(checked) =>
              onUpdate((draft) => {
                if (draft.settings.websockets) {
                  draft.settings.websockets.broadcastCrud = checked;
                }
              })
            }
          />
        </>
      )}
    </CardSection>
  );
}

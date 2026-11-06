import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import type { Project, QueuesConfig } from "@/core/model/schema";

export interface RedisConnectionConfigProps {
  queues: QueuesConfig;
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function RedisConnectionConfig({
  queues,
  onUpdate,
}: RedisConnectionConfigProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <FormRow
        label="Redis host"
        hint="Hostname or container name"
        htmlFor="settings-redis-host"
      >
        <Input
          id="settings-redis-host"
          value={queues.redisHost}
          maxLength={120}
          placeholder="localhost"
          onChange={(e) =>
            onUpdate((draft) => {
              if (draft.settings.queues) {
                draft.settings.queues.redisHost = e.target.value.trim() || "localhost";
              }
            })
          }
        />
      </FormRow>

      <FormRow
        label="Redis port"
        hint="Port (default: 6379)"
        htmlFor="settings-redis-port"
      >
        <Input
          id="settings-redis-port"
          type="number"
          min={1}
          max={65535}
          value={queues.redisPort}
          onChange={(e) =>
            onUpdate((draft) => {
              if (draft.settings.queues) {
                draft.settings.queues.redisPort = Number(e.target.value) || 6379;
              }
            })
          }
        />
      </FormRow>

      <FormRow
        label="Redis password"
        hint="Optional authentication"
        htmlFor="settings-redis-password"
      >
        <Input
          id="settings-redis-password"
          type="password"
          value={queues.redisPassword || ""}
          placeholder="(None)"
          onChange={(e) =>
            onUpdate((draft) => {
              if (draft.settings.queues) {
                draft.settings.queues.redisPassword = e.target.value || undefined;
              }
            })
          }
        />
      </FormRow>
    </div>
  );
}

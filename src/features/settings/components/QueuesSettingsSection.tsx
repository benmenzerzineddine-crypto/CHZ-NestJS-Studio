import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { ToggleRow } from "@/components/ui/form-row";
import { createQueue, createQueueJob, defaultQueues } from "@/core/model/defaults";
import type { Project, QueueDef } from "@/core/model/schema";
import { QueueCard } from "./queues/QueueCard";
import { RedisConnectionConfig } from "./queues/RedisConnectionConfig";

export interface QueuesSettingsSectionProps {
  queues?: Project["settings"]["queues"];
  onUpdate: (updater: (draft: Project) => void) => void;
}

export function QueuesSettingsSection({
  queues,
  onUpdate,
}: QueuesSettingsSectionProps) {
  const isEnabled = queues?.enabled ?? false;

  function handleAddQueue() {
    onUpdate((draft) => {
      if (!draft.settings.queues) {
        draft.settings.queues = defaultQueues();
      }
      const existingCount = draft.settings.queues.queues.length;
      const baseName = existingCount === 0 ? "mail" : `queue-${existingCount + 1}`;
      const defaultJob = createQueueJob("processItem");
      const newQueue = createQueue(baseName, [defaultJob]);
      draft.settings.queues.queues.push(newQueue);
    });
  }

  function handleRemoveQueue(queueId: string) {
    onUpdate((draft) => {
      if (!draft.settings.queues) return;
      draft.settings.queues.queues = draft.settings.queues.queues.filter(
        (q) => q.id !== queueId,
      );
    });
  }

  function handleAddJob(queueId: string) {
    onUpdate((draft) => {
      if (!draft.settings.queues) return;
      const queue = draft.settings.queues.queues.find((q) => q.id === queueId);
      if (!queue) return;
      const count = queue.jobs.length + 1;
      queue.jobs.push(createQueueJob(`job${count}`));
    });
  }

  function handleRemoveJob(queueId: string, jobId: string) {
    onUpdate((draft) => {
      if (!draft.settings.queues) return;
      const queue = draft.settings.queues.queues.find((q) => q.id === queueId);
      if (!queue) return;
      queue.jobs = queue.jobs.filter((j) => j.id !== jobId);
    });
  }

  return (
    <CardSection
      title="Background Jobs & Queues (BullMQ)"
      description="Asynchronous worker queues and background job dispatching powered by Redis."
    >
      <ToggleRow
        label="Background Queues"
        hint="Generate BullModule configuration, typed queue producers, and worker processors."
        checked={isEnabled}
        onCheckedChange={(checked) =>
          onUpdate((draft) => {
            if (!draft.settings.queues) {
              draft.settings.queues = defaultQueues();
            }
            draft.settings.queues.enabled = checked;
            if (checked && draft.settings.queues.queues.length === 0) {
              const defaultJob = createQueueJob("sendWelcomeEmail");
              draft.settings.queues.queues.push(createQueue("mail", [defaultJob]));
            }
          })
        }
      />

      {isEnabled && queues && (
        <div className="space-y-4 p-5">
          {/* Redis Server Connection Details */}
          <RedisConnectionConfig queues={queues} onUpdate={onUpdate} />

          {/* Configured Queues */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Configured Queues ({queues.queues.length})
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddQueue}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Queue
              </Button>
            </div>

            {queues.queues.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted">
                No queues configured. Click &quot;Add Queue&quot; to define your first background queue.
              </div>
            ) : (
              <div className="space-y-4">
                {queues.queues.map((queue: QueueDef) => (
                  <QueueCard
                    key={queue.id}
                    queue={queue}
                    onUpdate={onUpdate}
                    onRemoveQueue={handleRemoveQueue}
                    onAddJob={handleAddJob}
                    onRemoveJob={handleRemoveJob}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CardSection>
  );
}

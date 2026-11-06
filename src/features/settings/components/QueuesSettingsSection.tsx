import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createQueue, createQueueJob, defaultQueues } from "@/core/model/defaults";
import type { Project, QueueDef } from "@/core/model/schema";

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
                  <div
                    key={queue.id}
                    className="rounded-lg border border-border bg-surface/50 p-4"
                  >
                    {/* Queue Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                      <div className="flex flex-1 items-center gap-3">
                        <div className="w-48">
                          <label
                            className="block text-[10px] font-medium uppercase tracking-wider text-muted mb-1"
                            htmlFor={`queue-name-${queue.id}`}
                          >
                            Queue Name
                          </label>
                          <Input
                            id={`queue-name-${queue.id}`}
                            value={queue.name}
                            className="h-8 text-xs font-mono"
                            placeholder="mail"
                            onChange={(e) =>
                              onUpdate((draft) => {
                                const q = draft.settings.queues?.queues.find(
                                  (item) => item.id === queue.id,
                                );
                                if (q) q.name = e.target.value.toLowerCase().trim();
                              })
                            }
                          />
                        </div>

                        <div className="w-28">
                          <label
                            className="block text-[10px] font-medium uppercase tracking-wider text-muted mb-1"
                            htmlFor={`queue-concurrency-${queue.id}`}
                          >
                            Concurrency
                          </label>
                          <Input
                            id={`queue-concurrency-${queue.id}`}
                            type="number"
                            min={1}
                            max={100}
                            value={queue.concurrency ?? 1}
                            className="h-8 text-xs"
                            onChange={(e) =>
                              onUpdate((draft) => {
                                const q = draft.settings.queues?.queues.find(
                                  (item) => item.id === queue.id,
                                );
                                if (q) q.concurrency = Number(e.target.value) || 1;
                              })
                            }
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-danger hover:text-danger"
                        onClick={() => handleRemoveQueue(queue.id)}
                        aria-label={`Delete queue ${queue.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Jobs List inside Queue */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted">
                          Jobs in &quot;{queue.name || "unnamed"}&quot;
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] text-accent"
                          onClick={() => handleAddJob(queue.id)}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add Job
                        </Button>
                      </div>

                      {queue.jobs.map((job) => (
                        <div
                          key={job.id}
                          className="grid grid-cols-1 gap-2 rounded border border-border/40 bg-surface p-2 sm:grid-cols-4 items-center"
                        >
                          <div>
                            <Input
                              value={job.name}
                              placeholder="jobName"
                              className="h-7 text-xs font-mono"
                              onChange={(e) =>
                                onUpdate((draft) => {
                                  const q = draft.settings.queues?.queues.find(
                                    (item) => item.id === queue.id,
                                  );
                                  const j = q?.jobs.find((item) => item.id === job.id);
                                  if (j) j.name = e.target.value.trim();
                                })
                              }
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted">Retries:</span>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={job.attempts ?? 3}
                              className="h-7 text-xs w-16"
                              onChange={(e) =>
                                onUpdate((draft) => {
                                  const q = draft.settings.queues?.queues.find(
                                    (item) => item.id === queue.id,
                                  );
                                  const j = q?.jobs.find((item) => item.id === job.id);
                                  if (j) j.attempts = Number(e.target.value) || 1;
                                })
                              }
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted">Backoff:</span>
                            <Select
                              value={job.backoffType ?? "exponential"}
                              className="h-7 text-xs flex-1"
                              onChange={(e) =>
                                onUpdate((draft) => {
                                  const q = draft.settings.queues?.queues.find(
                                    (item) => item.id === queue.id,
                                  );
                                  const j = q?.jobs.find((item) => item.id === job.id);
                                  if (j) j.backoffType = e.target.value as any;
                                })
                              }
                            >
                              <option value="exponential">Exponential</option>
                              <option value="fixed">Fixed</option>
                            </Select>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted hover:text-danger"
                              onClick={() => handleRemoveJob(queue.id, job.id)}
                              aria-label={`Delete job ${job.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CardSection>
  );
}

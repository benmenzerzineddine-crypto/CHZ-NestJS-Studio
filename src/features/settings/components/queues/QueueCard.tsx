import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project, QueueDef } from "@/core/model/schema";
import { QueueJobRow } from "./QueueJobRow";

export interface QueueCardProps {
  queue: QueueDef;
  onUpdate: (updater: (draft: Project) => void) => void;
  onRemoveQueue: (queueId: string) => void;
  onAddJob: (queueId: string) => void;
  onRemoveJob: (queueId: string, jobId: string) => void;
}

export function QueueCard({
  queue,
  onUpdate,
  onRemoveQueue,
  onAddJob,
  onRemoveJob,
}: QueueCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface/50 p-4">
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
          onClick={() => onRemoveQueue(queue.id)}
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
            onClick={() => onAddJob(queue.id)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Job
          </Button>
        </div>

        {queue.jobs.map((job) => (
          <QueueJobRow
            key={job.id}
            queueId={queue.id}
            job={job}
            onUpdate={onUpdate}
            onRemove={onRemoveJob}
          />
        ))}
      </div>
    </div>
  );
}

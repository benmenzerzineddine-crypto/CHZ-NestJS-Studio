import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Project, QueueJobDef } from "@/core/model/schema";

export interface QueueJobRowProps {
  queueId: string;
  job: QueueJobDef;
  onUpdate: (updater: (draft: Project) => void) => void;
  onRemove: (queueId: string, jobId: string) => void;
}

export function QueueJobRow({
  queueId,
  job,
  onUpdate,
  onRemove,
}: QueueJobRowProps) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded border border-border/40 bg-surface p-2 sm:grid-cols-4 items-center">
      <div>
        <Input
          value={job.name}
          placeholder="jobName"
          className="h-7 text-xs font-mono"
          onChange={(e) =>
            onUpdate((draft) => {
              const q = draft.settings.queues?.queues.find((item) => item.id === queueId);
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
              const q = draft.settings.queues?.queues.find((item) => item.id === queueId);
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
              const q = draft.settings.queues?.queues.find((item) => item.id === queueId);
              const j = q?.jobs.find((item) => item.id === job.id);
              if (j) j.backoffType = e.target.value as "fixed" | "exponential";
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
          onClick={() => onRemove(queueId, job.id)}
          aria-label={`Delete job ${job.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

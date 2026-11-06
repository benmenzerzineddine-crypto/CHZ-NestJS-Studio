import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlaceholderScreenProps {
  icon: LucideIcon;
  title: string;
  description: string;
  milestone: string;
  detail?: string;
}

export function PlaceholderScreen({
  icon: Icon,
  title,
  description,
  milestone,
  detail,
}: PlaceholderScreenProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <div className="flex flex-col items-start rounded-xl border border-border bg-surface p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-raised">
          <Icon className="h-5 w-5 text-accent" />
        </div>

        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          <Badge variant="accent">{milestone}</Badge>
        </div>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
        {detail ? (
          <p className="mt-4 rounded-md border border-border bg-canvas px-3 py-2 text-xs text-muted">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

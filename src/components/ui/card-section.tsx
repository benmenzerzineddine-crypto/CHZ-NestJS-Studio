import { Card } from "@heroui/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CardSectionProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  divide?: boolean;
  className?: string;
  contentClassName?: string;
}

export function CardSection({
  title,
  description,
  action,
  children,
  divide = true,
  className,
  contentClassName,
}: CardSectionProps) {
  return (
    <Card className={cn("rounded-xl border border-border bg-surface", className)}>
      <Card.Header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <Card.Title className="text-sm font-semibold text-foreground">{title}</Card.Title>
          {description ? (
            <Card.Description className="mt-0.5 text-xs text-muted">{description}</Card.Description>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </Card.Header>
      <Card.Content className={cn("p-0", divide && "divide-y divide-border", contentClassName)}>
        {children}
      </Card.Content>
    </Card>
  );
}


import { Badge, type BadgeProps } from "./badge";
import type { HttpMethod } from "@/core/model/schema";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export const METHOD_BADGE_VARIANTS: Record<HttpMethod, BadgeVariant> = {
  GET: "accent",
  POST: "success",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger",
};

export interface MethodBadgeProps {
  method: HttpMethod;
  className?: string;
}

export function MethodBadge({ method, className }: MethodBadgeProps) {
  return (
    <Badge variant={METHOD_BADGE_VARIANTS[method]} className={className}>
      {method}
    </Badge>
  );
}

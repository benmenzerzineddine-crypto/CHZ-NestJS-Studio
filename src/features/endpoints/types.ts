import type { AccessLevel, Operation } from "@/core/model/schema";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AccessBadge = AccessLevel | "admin";
export type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger";

export interface RouteEntry {
  method: HttpMethod;
  path: string;
  access: AccessBadge;
  note?: string;
  isCustom?: boolean;
  throttle?: string;
  cache?: string;
}

export interface RouteGroup {
  name: string;
  path: string;
  routes: RouteEntry[];
  multitenant?: boolean;
  throttle?: string;
  cache?: string;
}

export const ACCESS_LABELS: Record<AccessBadge, string> = {
  public: "Public",
  authenticated: "Authenticated",
  roles: "Roles",
  owner: "Owner",
  admin: "Admin",
};

export const ACCESS_VARIANTS: Record<AccessBadge, BadgeVariant> = {
  public: "warning",
  authenticated: "default",
  roles: "accent",
  owner: "success",
  admin: "accent",
};

export const OPERATION_METHODS: Array<{
  operation: Operation;
  method: HttpMethod;
  suffix: string;
}> = [
  { operation: "list", method: "GET", suffix: "" },
  { operation: "read", method: "GET", suffix: "/:id" },
  { operation: "create", method: "POST", suffix: "" },
  { operation: "update", method: "PATCH", suffix: "/:id" },
  { operation: "delete", method: "DELETE", suffix: "/:id" },
];

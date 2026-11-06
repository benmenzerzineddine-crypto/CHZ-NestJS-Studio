import type { AccessLevel, Operation } from "@/core/model/schema";

export const OPERATION_LABELS: Record<Operation, string> = {
  list: "List",
  read: "Read",
  create: "Create",
  update: "Update",
  delete: "Delete",
};

export const LEVEL_LABELS: Record<AccessLevel, string> = {
  public: "Public",
  authenticated: "Authenticated",
  roles: "Roles",
  owner: "Owner only",
};

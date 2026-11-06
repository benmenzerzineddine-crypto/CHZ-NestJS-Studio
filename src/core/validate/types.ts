import type { Operation } from "../model/schema";

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  entityId?: string;
  fieldId?: string;
  relationId?: string;
  enumId?: string;
  customEndpointId?: string;
  operation?: Operation;
  fixHint?: string;
}

export interface IssueInput extends Omit<ValidationIssue, "severity"> {
  severity?: IssueSeverity;
}

export function issue(input: IssueInput): ValidationIssue {
  return { severity: "error", ...input };
}

export const ENTITY_NAME = /^[A-Z][A-Za-z0-9]*$/;
export const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;
export const ENUM_VALUE = /^[A-Za-z][A-Za-z0-9_]*$/;
export const PACKAGE_NAME = /^[a-z0-9][a-z0-9-]*$/;
export const API_PREFIX = /^[a-z][a-z0-9-]*$/;
export const DURATION = /^\d+[smhd]$/;
export const CRUD_METHOD_NAMES = new Set(["create", "findAll", "findOne", "update", "remove", "restore"]);

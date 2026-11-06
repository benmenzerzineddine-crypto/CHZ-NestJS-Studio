import { AUTH_RESERVED_FIELD_NAMES } from "../model/defaults";
import type { EntityDef, Project } from "../model/schema";
import { FIELD_NAME, issue, type ValidationIssue } from "./types";

export function checkFields(
  project: Project,
  entity: EntityDef,
  issues: ValidationIssue[],
  fieldNames: Set<string>,
): void {
  for (const field of entity.fields) {
    if (!FIELD_NAME.test(field.name)) {
      issues.push(
        issue({
          code: "field.name.invalid",
          entityId: entity.id,
          fieldId: field.id,
          message: `"${field.name}" is not a valid field name (use camelCase).`,
        }),
      );
    }

    if ((AUTH_RESERVED_FIELD_NAMES as readonly string[]).includes(field.name)) {
      issues.push(
        issue({
          code: "field.name.reserved",
          entityId: entity.id,
          fieldId: field.id,
          message: `"${field.name}" is managed by the auth module and cannot be a model field.`,
        }),
      );
    }

    if (entity.options.multitenant && field.name === "tenantId") {
      issues.push(
        issue({
          code: "field.name.reserved",
          entityId: entity.id,
          fieldId: field.id,
          message: `"tenantId" is managed by multi-tenancy and cannot be a model field.`,
        }),
      );
    }

    if (fieldNames.has(field.name)) {
      issues.push(
        issue({
          code: "field.name.duplicate",
          entityId: entity.id,
          fieldId: field.id,
          message: `Duplicate field "${field.name}".`,
        }),
      );
    }
    fieldNames.add(field.name);

    if (field.type === "enum") {
      if (!field.enumId) {
        issues.push(
          issue({
            code: "field.enum.missing",
            entityId: entity.id,
            fieldId: field.id,
            message: `Enum field "${field.name}" needs an enum.`,
          }),
        );
      } else if (!project.enums.some((candidate) => candidate.id === field.enumId)) {
        issues.push(
          issue({
            code: "field.enum.unknown",
            entityId: entity.id,
            fieldId: field.id,
            message: `Enum field "${field.name}" references a missing enum.`,
          }),
        );
      }
    } else if (field.enumId) {
      issues.push(
        issue({
          code: "field.enum.unexpected",
          entityId: entity.id,
          fieldId: field.id,
          message: `Only enum fields can reference an enum ("${field.name}").`,
        }),
      );
    }

    if (field.primary && field.type !== "uuid" && field.type !== "int") {
      issues.push(
        issue({
          code: "field.primary.type",
          entityId: entity.id,
          fieldId: field.id,
          message: `Primary key "${field.name}" must be uuid or int.`,
        }),
      );
    }

    if (field.primary && !field.required) {
      issues.push(
        issue({
          code: "field.primary.nullable",
          entityId: entity.id,
          fieldId: field.id,
          message: `Primary key "${field.name}" cannot be nullable.`,
        }),
      );
    }

    const validators = field.validators;
    if (
      validators?.min !== undefined &&
      validators.max !== undefined &&
      validators.min > validators.max
    ) {
      issues.push(
        issue({
          code: "field.validator.range",
          entityId: entity.id,
          fieldId: field.id,
          message: `"${field.name}" has min greater than max.`,
        }),
      );
    }

    if (
      validators?.minLength !== undefined &&
      validators.maxLength !== undefined &&
      validators.minLength > validators.maxLength
    ) {
      issues.push(
        issue({
          code: "field.validator.length",
          entityId: entity.id,
          fieldId: field.id,
          message: `"${field.name}" has minLength greater than maxLength.`,
        }),
      );
    }

    if (
      field.column?.precision !== undefined &&
      field.column.scale !== undefined &&
      field.column.scale > field.column.precision
    ) {
      issues.push(
        issue({
          code: "field.column.scale",
          entityId: entity.id,
          fieldId: field.id,
          message: `"${field.name}" has scale greater than precision.`,
        }),
      );
    }
  }

  const primaries = entity.fields.filter((field) => field.primary);
  if (primaries.length > 1) {
    issues.push(
      issue({
        code: "field.primary.multiple",
        entityId: entity.id,
        message: `${entity.name} has ${primaries.length} primary fields; only one is allowed.`,
      }),
    );
  }
}

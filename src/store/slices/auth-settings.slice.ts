import { ADMIN_ROLE, USER_ENTITY_ID, createRelation } from "@/core/model/defaults";
import {
  OPERATIONS,
  type AccessRule,
  type AuthConfig,
  type MultitenancyConfig,
  type Operation,
  type ThrottlingConfig,
  type UploadConfig,
} from "@/core/model/schema";
import { isRoleUsed } from "./store-helpers";
import type { ProjectStore } from "./types";

export function createAuthSettingsSlice(get: () => ProjectStore) {
  return {
    setAccess: (entityId: string, operation: Operation, rule: AccessRule): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;

        entity.access[operation] =
          rule.level === "roles"
            ? { level: "roles", roles: rule.roles ?? [] }
            : { level: rule.level };
        const usesOwner = OPERATIONS.some(
          (candidate) => entity.access[candidate].level === "owner",
        );
        const user = draft.entities.find((candidate) => candidate.id === USER_ENTITY_ID);
        const ownerRelationName = entity.options.ownerRelation;
        const hasValidOwnerRelation =
          user !== undefined &&
          ownerRelationName !== undefined &&
          entity.relations.some(
            (relation) =>
              relation.name === ownerRelationName &&
              relation.targetEntityId === user.id &&
              relation.kind === "many-to-one",
          );

        if (usesOwner && user && !hasValidOwnerRelation) {
          let relationName = "owner";
          let index = 2;
          while (
            entity.fields.some((field) => field.name === relationName) ||
            entity.relations.some((relation) => relation.name === relationName)
          ) {
            relationName = `owner${index}`;
            index += 1;
          }

          entity.relations.push(
            createRelation(relationName, user.id, "many-to-one", { nullable: true }),
          );
          entity.options.owner = true;
          entity.options.ownerRelation = relationName;
        }

        if (!usesOwner && entity.options.owner) {
          const ownerRelation = entity.options.ownerRelation;
          if (ownerRelation) {
            entity.relations = entity.relations.filter(
              (relation) => relation.name !== ownerRelation,
            );
          }
          entity.options.owner = false;
          entity.options.ownerRelation = undefined;
        }
      });
    },

    updateAuth: (mutator: (draft: AuthConfig) => void): void => {
      get().updateProject((draft) => {
        mutator(draft.auth);
      });
    },

    updateUploadSettings: (patch: Partial<UploadConfig>): void => {
      get().updateProject((draft) => {
        if (!draft.settings.uploads) {
          draft.settings.uploads = {
            enabled: false,
            driver: "local",
            maxFileSizeMb: 10,
          };
        }
        Object.assign(draft.settings.uploads, patch);
      });
    },

    updateMultitenancySettings: (patch: Partial<MultitenancyConfig>): void => {
      get().updateProject((draft) => {
        if (!draft.settings.multitenancy) {
          draft.settings.multitenancy = {
            enabled: false,
            header: "x-tenant-id",
          };
        }
        Object.assign(draft.settings.multitenancy, patch);
      });
    },

    updateThrottlingSettings: (patch: Partial<ThrottlingConfig>): void => {
      get().updateProject((draft) => {
        if (!draft.settings.throttling) {
          draft.settings.throttling = {
            enabled: true,
            ttl: 60,
            limit: 100,
          };
        }
        Object.assign(draft.settings.throttling, patch);
      });
    },

    addRole: (key: string, label: string): boolean => {
      const project = get().project;
      if (!project) return false;
      if (!/^[a-z][a-z0-9_-]*$/.test(key)) return false;
      if (project.auth.roles.some((role) => role.key === key)) return false;

      get().updateProject((draft) => {
        draft.auth.roles.push({ key, label });
      });
      return true;
    },

    renameRole: (oldKey: string, newKey: string): boolean => {
      const project = get().project;
      if (!project || oldKey === ADMIN_ROLE) return false;
      if (!/^[a-z][a-z0-9_-]*$/.test(newKey)) return false;
      if (project.auth.roles.some((role) => role.key === newKey)) return false;

      get().updateProject((draft) => {
        const role = draft.auth.roles.find((candidate) => candidate.key === oldKey);
        if (!role) return;
        role.key = newKey;

        for (const entity of draft.entities) {
          for (const operation of OPERATIONS) {
            const rule = entity.access[operation];
            if (rule.roles) {
              rule.roles = rule.roles.map((key) => (key === oldKey ? newKey : key));
            }
          }
        }
      });

      return true;
    },

    updateRoleLabel: (key: string, label: string): void => {
      get().updateProject((draft) => {
        const role = draft.auth.roles.find((candidate) => candidate.key === key);
        if (role) role.label = label;
      });
    },

    removeRole: (key: string): boolean => {
      const project = get().project;
      if (!project || key === ADMIN_ROLE) return false;
      if (isRoleUsed(project, key)) return false;

      get().updateProject((draft) => {
        draft.auth.roles = draft.auth.roles.filter((role) => role.key !== key);
      });
      return true;
    },
  };
}

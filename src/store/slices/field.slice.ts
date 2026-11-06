import { createField } from "@/core/model/defaults";
import type { FieldDef, FieldType } from "@/core/model/schema";
import { normalizeField } from "./store-helpers";
import type { ProjectStore } from "./types";

export function createFieldSlice(get: () => ProjectStore) {
  return {
    addField: (entityId: string, name: string, type: FieldType): string | null => {
      const field = createField(name, type);
      let added = false;

      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;
        entity.fields.push(field);
        added = true;
      });

      return added ? field.id : null;
    },

    updateField: (entityId: string, fieldId: string, patch: Partial<FieldDef>): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        const field = entity?.fields.find((candidate) => candidate.id === fieldId);
        if (!entity || !field) return;

        const previousName = field.name;
        const previousType = field.type;

        Object.assign(field, patch);
        normalizeField(field, patch, previousType);

        if (patch.primary === true) {
          for (const other of entity.fields) {
            if (other.id !== field.id) other.primary = false;
          }
          field.required = true;
        }

        if (patch.name !== undefined && patch.name !== previousName) {
          entity.options.searchFields = entity.options.searchFields.map((name) =>
            name === previousName ? field.name : name,
          );
          entity.options.sortFields = entity.options.sortFields.map((name) =>
            name === previousName ? field.name : name,
          );
        }
      });
    },

    deleteField: (entityId: string, fieldId: string): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        const field = entity?.fields.find((candidate) => candidate.id === fieldId);
        if (!entity || !field) return;

        const name = field.name;
        entity.fields = entity.fields.filter((candidate) => candidate.id !== fieldId);
        entity.options.searchFields = entity.options.searchFields.filter(
          (candidate) => candidate !== name,
        );
        entity.options.sortFields = entity.options.sortFields.filter(
          (candidate) => candidate !== name,
        );
      });
    },

    moveField: (entityId: string, fieldId: string, direction: -1 | 1): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;

        const index = entity.fields.findIndex((field) => field.id === fieldId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= entity.fields.length) return;

        const [field] = entity.fields.splice(index, 1);
        if (field) entity.fields.splice(target, 0, field);
      });
    },

    reorderField: (entityId: string, fieldId: string, targetIndex: number): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;

        const index = entity.fields.findIndex((field) => field.id === fieldId);
        if (index === -1 || targetIndex < 0 || targetIndex >= entity.fields.length) return;

        const [field] = entity.fields.splice(index, 1);
        if (field) entity.fields.splice(targetIndex, 0, field);
      });
    },
  };
}

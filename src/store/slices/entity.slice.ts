import {
  USER_ENTITY_ID,
  createEntity,
  createId,
  createRelation,
  isSystemEntity,
} from "@/core/model/defaults";
import type { EntityOptions } from "@/core/model/schema";
import { uniqueEntityName } from "./store-helpers";
import type { ProjectStore } from "./types";

export function createEntitySlice(get: () => ProjectStore) {
  return {
    addEntity: (name: string): string => {
      const entity = createEntity(name);
      const user = get().project?.entities.find(
        (candidate) => candidate.id === USER_ENTITY_ID,
      );

      if (user) {
        entity.relations.push(
          createRelation("owner", user.id, "many-to-one", { nullable: true }),
        );
        entity.options.owner = true;
        entity.options.ownerRelation = "owner";
      }

      get().updateProject((draft) => {
        draft.entities.push(entity);
      });
      return entity.id;
    },

    duplicateEntity: (entityId: string): string | null => {
      const project = get().project;
      const source = project?.entities.find((entity) => entity.id === entityId);
      if (!project || !source || isSystemEntity(source)) return null;

      const clone = structuredClone(source);
      clone.id = createId("ent");
      clone.name = uniqueEntityName(`${source.name}Copy`, project.entities);
      clone.fields = clone.fields.map((field) => ({ ...structuredClone(field), id: createId("fld") }));
      clone.relations = clone.relations.map((relation) => ({
        ...structuredClone(relation),
        id: createId("rel"),
      }));
      clone.customEndpoints = (clone.customEndpoints ?? []).map((ep) => ({
        ...structuredClone(ep),
        id: createId("ep"),
      }));

      get().updateProject((draft) => {
        const sourceIndex = draft.entities.findIndex((entity) => entity.id === entityId);
        draft.entities.splice(sourceIndex + 1, 0, clone);
      });

      return clone.id;
    },

    deleteEntity: (entityId: string): boolean => {
      const project = get().project;
      const entity = project?.entities.find((candidate) => candidate.id === entityId);
      if (!project || !entity || isSystemEntity(entity)) return false;

      get().updateProject((draft) => {
        draft.entities = draft.entities.filter((candidate) => candidate.id !== entityId);
        for (const candidate of draft.entities) {
          candidate.relations = candidate.relations.filter(
            (relation) => relation.targetEntityId !== entityId,
          );
        }
      });

      return true;
    },

    renameEntity: (entityId: string, name: string): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity || isSystemEntity(entity)) return;
        entity.name = name;
      });
    },

    updateEntityOptions: (entityId: string, patch: Partial<EntityOptions>): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;
        Object.assign(entity.options, patch);
      });
    },

    updateEntityDescription: (entityId: string, description: string): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;
        if (description.trim()) entity.description = description;
        else delete entity.description;
      });
    },
  };
}

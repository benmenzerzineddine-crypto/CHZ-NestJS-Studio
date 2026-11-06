import { createRelation } from "@/core/model/defaults";
import type { ProjectStore, RelationInput, RelationPatch } from "./types";

export function createRelationSlice(get: () => ProjectStore) {
  return {
    addRelation: (entityId: string, input: RelationInput): string | null => {
      if (input.kind === "one-to-many") return null;

      const relation = createRelation(input.name, input.targetEntityId, input.kind, {
        nullable: input.nullable,
        cascade: input.cascade,
      });

      let added = false;
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;
        entity.relations.push(relation);
        added = true;
      });

      return added ? relation.id : null;
    },

    updateRelation: (entityId: string, relationId: string, patch: RelationPatch): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        const relation = entity?.relations.find((candidate) => candidate.id === relationId);
        if (!entity || !relation) return;

        const previousName = relation.name;
        Object.assign(relation, patch);

        if (
          entity.options.ownerRelation === previousName &&
          patch.name !== undefined
        ) {
          entity.options.ownerRelation = relation.name;
        }
      });
    },

    deleteRelation: (entityId: string, relationId: string): boolean => {
      const project = get().project;
      const entity = project?.entities.find((candidate) => candidate.id === entityId);
      const relation = entity?.relations.find((candidate) => candidate.id === relationId);
      if (!project || !entity || !relation) return false;
      if (entity.options.ownerRelation === relation.name) return false;

      get().updateProject((draft) => {
        const target = draft.entities.find((candidate) => candidate.id === entityId);
        if (!target) return;
        target.relations = target.relations.filter((candidate) => candidate.id !== relationId);
      });

      return true;
    },
  };
}

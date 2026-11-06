import { createEnum } from "@/core/model/defaults";
import type { CustomEndpointDef } from "@/core/model/schema";
import type { ProjectStore } from "./types";

export function createEndpointEnumSlice(get: () => ProjectStore) {
  return {
    addCustomEndpoint: (entityId: string, endpoint: CustomEndpointDef): string | null => {
      let added = false;
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity) return;
        if (!entity.customEndpoints) entity.customEndpoints = [];
        entity.customEndpoints.push(endpoint);
        added = true;
      });
      return added ? endpoint.id : null;
    },

    updateCustomEndpoint: (
      entityId: string,
      endpointId: string,
      patch: Partial<CustomEndpointDef>,
    ): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        const endpoint = entity?.customEndpoints?.find((candidate) => candidate.id === endpointId);
        if (!entity || !endpoint) return;
        Object.assign(endpoint, patch);
      });
    },

    deleteCustomEndpoint: (entityId: string, endpointId: string): void => {
      get().updateProject((draft) => {
        const entity = draft.entities.find((candidate) => candidate.id === entityId);
        if (!entity || !entity.customEndpoints) return;
        entity.customEndpoints = entity.customEndpoints.filter(
          (candidate) => candidate.id !== endpointId,
        );
      });
    },

    addEnum: (name: string, values: string[] = ["VALUE"]): string => {
      const enumDef = createEnum(name, values);
      get().updateProject((draft) => {
        draft.enums.push(enumDef);
      });
      return enumDef.id;
    },

    updateEnum: (
      enumId: string,
      mutator: (draft: { name: string; values: string[] }) => void,
    ): void => {
      get().updateProject((draft) => {
        const enumDef = draft.enums.find((candidate) => candidate.id === enumId);
        if (enumDef) mutator(enumDef);
      });
    },

    deleteEnum: (enumId: string): boolean => {
      const project = get().project;
      if (!project) return false;
      const used = project.entities.some((entity) =>
        entity.fields.some((field) => field.enumId === enumId),
      );
      if (used) return false;

      get().updateProject((draft) => {
        draft.enums = draft.enums.filter((candidate) => candidate.id !== enumId);
      });
      return true;
    },
  };
}

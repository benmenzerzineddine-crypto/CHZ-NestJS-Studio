import type {
  AccessRule,
  AuthConfig,
  CustomEndpointDef,
  EntityOptions,
  FieldDef,
  FieldType,
  MultitenancyConfig,
  Operation,
  Project,
  RelationDef,
  ThrottlingConfig,
  UploadConfig,
} from "@/core/model/schema";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface RelationInput {
  name: string;
  targetEntityId: string;
  kind: RelationDef["kind"];
  nullable: boolean;
  cascade: boolean;
}

export type RelationPatch = Partial<Pick<RelationDef, "name" | "nullable" | "cascade">>;

export interface ProjectStore {
  project: Project | null;
  status: SaveStatus;
  revision: number;
  lastSavedAt: string | null;
  error: string | null;

  openProject: (project: Project) => void;
  closeProject: () => Promise<boolean>;
  updateProject: (mutator: (draft: Project) => void) => void;
  saveNow: () => Promise<boolean>;
  setLastExportPath: (path: string) => void;

  addEntity: (name: string) => string;
  duplicateEntity: (entityId: string) => string | null;
  deleteEntity: (entityId: string) => boolean;
  renameEntity: (entityId: string, name: string) => void;
  updateEntityDescription: (entityId: string, description: string) => void;
  updateEntityOptions: (entityId: string, patch: Partial<EntityOptions>) => void;

  addField: (entityId: string, name: string, type: FieldType) => string | null;
  updateField: (entityId: string, fieldId: string, patch: Partial<FieldDef>) => void;
  deleteField: (entityId: string, fieldId: string) => void;
  moveField: (entityId: string, fieldId: string, direction: -1 | 1) => void;
  reorderField: (entityId: string, fieldId: string, targetIndex: number) => void;

  addRelation: (entityId: string, input: RelationInput) => string | null;
  updateRelation: (entityId: string, relationId: string, patch: RelationPatch) => void;
  deleteRelation: (entityId: string, relationId: string) => boolean;

  addCustomEndpoint: (entityId: string, endpoint: CustomEndpointDef) => string | null;
  updateCustomEndpoint: (entityId: string, endpointId: string, patch: Partial<CustomEndpointDef>) => void;
  deleteCustomEndpoint: (entityId: string, endpointId: string) => void;

  addEnum: (name: string, values?: string[]) => string;
  updateEnum: (enumId: string, mutator: (draft: { name: string; values: string[] }) => void) => void;
  deleteEnum: (enumId: string) => boolean;

  setAccess: (entityId: string, operation: Operation, rule: AccessRule) => void;
  updateAuth: (mutator: (draft: AuthConfig) => void) => void;
  updateUploadSettings: (patch: Partial<UploadConfig>) => void;
  updateMultitenancySettings: (patch: Partial<MultitenancyConfig>) => void;
  updateThrottlingSettings: (patch: Partial<ThrottlingConfig>) => void;
  addRole: (key: string, label: string) => boolean;
  renameRole: (oldKey: string, newKey: string) => boolean;
  updateRoleLabel: (key: string, label: string) => void;
  removeRole: (key: string) => boolean;
}

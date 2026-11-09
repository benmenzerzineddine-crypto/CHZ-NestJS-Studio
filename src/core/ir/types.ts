import type {
  AccessMatrix,
  AccessRule,
  AuthConfig,
  CustomEndpointDef,
  Driver,
  EntityDef,
  EntityOptions,
  EnumDef,
  FieldDef,
  HttpMethod,
  Project,
  RelationDef,
  RelationKind,
  UploadConfig,
  MultitenancyConfig,
  ThrottlingConfig,
  GraphQLConfig,
  QueuesConfig,
  WebSocketConfig,
  SeedingConfig,
  ThrottleOverride,
  CacheHint,
} from "../model/schema";

export interface UploadIR extends UploadConfig {}

export interface MultitenancyIR extends MultitenancyConfig {}

export interface ThrottlingIR extends ThrottlingConfig {}

export interface GraphQLIR extends GraphQLConfig {}

export interface QueuesIR extends QueuesConfig {}

export interface WebSocketsIR extends WebSocketConfig {}

export interface SeedingIR extends SeedingConfig {}

export interface CustomEndpointIR {
  definition: CustomEndpointDef;
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  routePath: string;
  description?: string;
  access: AccessRule;
  hasIdParam: boolean;
  throttle?: ThrottleOverride;
  skipThrottle?: boolean;
  cache?: CacheHint;
}

export type FileKind = "typescript" | "json" | "config" | "markdown" | "env" | "docker";

export interface GeneratedFile {
  path: string;
  content: string;
  kind: FileKind;
}

export interface FileTree {
  name: string;
  path: string;
  files: GeneratedFile[];
  children: FileTree[];
}

export interface EnumIR {
  id: string;
  name: string;
  values: string[];
  members: string[];
  definition: EnumDef;
}

export interface AuthIR extends AuthConfig {
  adminRole: string;
  defaultRole: string;
}

export interface FieldIR {
  definition: FieldDef;
  id: string;
  name: string;
  type: FieldDef["type"];
  required: boolean;
  unique: boolean;
  indexed: boolean;
  primary: boolean;
  defaultValue?: string;
  columnName: string;
  tsType: string;
  enum?: EnumIR;
  generated: boolean;
}

export interface RelationIR {
  definition: RelationDef;
  id: string;
  name: string;
  kind: RelationKind;
  target: EntityIR;
  nullable: boolean;
  cascade: boolean;
  owner: boolean;
  fkName?: string;
  fkType: "string" | "number";
  joinTableName?: string;
  joinColumnName?: string;
  inverseJoinColumnName?: string;
  inverseName?: string;
  inverseKind?: RelationKind;
}

export interface DerivedRelationIR {
  name: string;
  kind: RelationKind;
  source: EntityIR;
  sourceRelation: RelationIR;
}

export interface EntityIR {
  definition: EntityDef;
  id: string;
  name: string;
  singularKebab: string;
  pluralKebab: string;
  restPath: string;
  tableName: string;
  moduleDir: string;
  dtoPrefix: string;
  fields: FieldIR[];
  primary: FieldIR;
  implicitPrimary: boolean;
  relations: RelationIR[];
  derivedRelations: DerivedRelationIR[];
  ownerRelation?: RelationIR;
  ownerColumn?: string;
  timestamps: boolean;
  softDelete: boolean;
  multitenant: boolean;
  throttle?: ThrottleOverride;
  cache?: CacheHint;
  options: EntityOptions;
  access: AccessMatrix;
  customEndpoints: CustomEndpointIR[];
  isSystem: boolean;
}

export interface ProjectIR {
  project: Project;
  generatorVersion: string;
  name: string;
  packageName: string;
  driver: Driver;
  apiPrefix: string;
  auth: AuthIR;
  uploads: UploadIR;
  multitenancy: MultitenancyIR;
  throttling: ThrottlingIR;
  graphql: GraphQLIR;
  queues: QueuesIR;
  websockets: WebSocketsIR;
  seeding: SeedingIR;
  enums: EnumIR[];
  entities: EntityIR[];
  user?: EntityIR;
  enumById: Map<string, EnumIR>;
  entityById: Map<string, EntityIR>;
}

export function entityFileBase(entity: Pick<EntityIR, "singularKebab">): string {
  return entity.singularKebab;
}

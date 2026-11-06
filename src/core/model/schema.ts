import { z } from "zod";

export const DRIVERS = ["postgres", "mysql", "sqlite"] as const;
export const driverSchema = z.enum(DRIVERS);
export type Driver = z.infer<typeof driverSchema>;

export const OPERATIONS = ["list", "read", "create", "update", "delete"] as const;
export const operationSchema = z.enum(OPERATIONS);
export type Operation = (typeof OPERATIONS)[number];

export const ACCESS_LEVELS = ["public", "authenticated", "roles", "owner"] as const;
export const accessLevelSchema = z.enum(ACCESS_LEVELS);
export type AccessLevel = z.infer<typeof accessLevelSchema>;

export const FIELD_TYPES = [
  "string",
  "text",
  "int",
  "float",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "uuid",
  "json",
  "enum",
] as const;
export const fieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof fieldTypeSchema>;

export const RELATION_KINDS = ["many-to-one", "one-to-many", "one-to-one", "many-to-many"] as const;
export const relationKindSchema = z.enum(RELATION_KINDS);
export type RelationKind = z.infer<typeof relationKindSchema>;

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const httpMethodSchema = z.enum(HTTP_METHODS);
export type HttpMethod = z.infer<typeof httpMethodSchema>;

const idSchema = z
  .string()
  .regex(/^[a-z]{2,6}_[a-z0-9]{3,40}$/, "Invalid id");

const entityNameSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Z][A-Za-z0-9]*$/, "Use PascalCase, e.g. BlogPost");

const camelNameSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z][A-Za-z0-9]*$/, "Use camelCase, e.g. publishedAt");

const enumNameSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Z][A-Za-z0-9]*$/, "Use PascalCase, e.g. PostStatus");

const enumValueSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Use letters, digits and underscores");

const roleKeySchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_-]*$/, "Use lowercase letters, digits, dashes or underscores");

const durationSchema = z
  .string()
  .regex(/^\d+[smhd]$/, "Use a duration such as 15m or 7d");

const timestampSchema = z.iso.datetime();

export const accessRuleSchema = z
  .strictObject({
    level: accessLevelSchema,
    roles: z.array(roleKeySchema).max(20).optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.level === "roles" && (rule.roles?.length ?? 0) === 0) {
      ctx.addIssue({ code: "custom", path: ["roles"], message: "Select at least one role" });
    }
    if (rule.level !== "roles" && (rule.roles?.length ?? 0) > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["roles"],
        message: "Roles are only allowed with the roles level",
      });
    }
  });
export type AccessRule = z.infer<typeof accessRuleSchema>;

export const accessMatrixSchema = z.strictObject({
  list: accessRuleSchema,
  read: accessRuleSchema,
  create: accessRuleSchema,
  update: accessRuleSchema,
  delete: accessRuleSchema,
});
export type AccessMatrix = z.infer<typeof accessMatrixSchema>;

export const throttleOverrideSchema = z.strictObject({
  limit: z.number().int().min(1).max(100000),
  ttl: z.number().int().min(1).max(3600),
});
export type ThrottleOverride = z.infer<typeof throttleOverrideSchema>;

export const CACHE_SCOPES = ["public", "private", "no-cache", "no-store"] as const;
export const cacheScopeSchema = z.enum(CACHE_SCOPES);
export type CacheScope = z.infer<typeof cacheScopeSchema>;

export const cacheHintSchema = z.strictObject({
  maxAge: z.number().int().min(0).max(31536000),
  scope: cacheScopeSchema.default("public"),
  sharedMaxAge: z.number().int().min(0).max(31536000).optional(),
});
export type CacheHint = z.infer<typeof cacheHintSchema>;

export const customEndpointSchema = z.strictObject({
  id: idSchema,
  name: camelNameSchema,
  method: httpMethodSchema,
  path: z.string().min(1).max(100).regex(/^[a-z0-9_/:.-]+$/, "Invalid path syntax"),
  description: z.string().max(200).optional(),
  access: accessRuleSchema,
  throttle: throttleOverrideSchema.optional(),
  skipThrottle: z.boolean().optional(),
  cache: cacheHintSchema.optional(),
});
export type CustomEndpointDef = z.infer<typeof customEndpointSchema>;

export const authRoleSchema = z.strictObject({
  key: roleKeySchema,
  label: z.string().min(1).max(40),
});
export type AuthRole = z.infer<typeof authRoleSchema>;

export const oauthProvidersSchema = z.strictObject({
  google: z.boolean().default(false),
  github: z.boolean().default(false),
});
export type OAuthProviders = z.infer<typeof oauthProvidersSchema>;

export const authConfigSchema = z
  .strictObject({
    enabled: z.boolean(),
    registerEnabled: z.boolean(),
    refreshTokens: z.boolean(),
    accessTokenTtl: durationSchema,
    refreshTokenTtl: durationSchema,
    passwordMinLength: z.number().int().min(6).max(72),
    seedAdmin: z.boolean(),
    adminUserEndpoints: z.boolean(),
    roles: z.array(authRoleSchema).min(1).max(20),
    passwordReset: z.boolean().default(false),
    emailVerification: z.boolean().default(false),
    passwordResetTtl: durationSchema.default("1h"),
    emailVerificationTtl: durationSchema.default("24h"),
    oauth: oauthProvidersSchema.default({
      google: false,
      github: false,
    }),
    twoFactor: z.boolean().default(false),
  })
  .superRefine((auth, ctx) => {
    const seen = new Set<string>();
    for (const [index, role] of auth.roles.entries()) {
      if (seen.has(role.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["roles", index, "key"],
          message: `Duplicate role "${role.key}"`,
        });
      }
      seen.add(role.key);
    }
  });
export type AuthConfig = z.infer<typeof authConfigSchema>;

export const fieldValidatorsSchema = z.strictObject({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().min(1).max(200).optional(),
});
export type FieldValidators = z.infer<typeof fieldValidatorsSchema>;

export const fieldColumnSchema = z.strictObject({
  length: z.number().int().positive().max(65_535).optional(),
  precision: z.number().int().positive().max(65).optional(),
  scale: z.number().int().nonnegative().max(30).optional(),
});
export type FieldColumn = z.infer<typeof fieldColumnSchema>;

export const fieldDefinitionSchema = z
  .strictObject({
    id: idSchema,
    name: camelNameSchema,
    type: fieldTypeSchema,
    required: z.boolean(),
    unique: z.boolean(),
    indexed: z.boolean(),
    primary: z.boolean(),
    defaultValue: z.string().max(200).optional(),
    enumId: idSchema.optional(),
    column: fieldColumnSchema.optional(),
    validators: fieldValidatorsSchema.optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "enum" && !field.enumId) {
      ctx.addIssue({ code: "custom", path: ["enumId"], message: "Choose an enum" });
    }
    if (field.type !== "enum" && field.enumId) {
      ctx.addIssue({
        code: "custom",
        path: ["enumId"],
        message: "Only enum fields can reference an enum",
      });
    }
    if (field.primary && field.type !== "uuid" && field.type !== "int") {
      ctx.addIssue({
        code: "custom",
        path: ["primary"],
        message: "Primary keys must be uuid or int",
      });
    }
    if (field.primary && !field.required) {
      ctx.addIssue({
        code: "custom",
        path: ["required"],
        message: "Primary keys cannot be nullable",
      });
    }
    if (
      field.column?.precision !== undefined &&
      field.column.scale !== undefined &&
      field.column.scale > field.column.precision
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["column", "scale"],
        message: "Scale cannot exceed precision",
      });
    }
  });
export type FieldDef = z.infer<typeof fieldDefinitionSchema>;

export const relationDefinitionSchema = z.strictObject({
  id: idSchema,
  name: camelNameSchema,
  targetEntityId: idSchema,
  kind: relationKindSchema,
  nullable: z.boolean(),
  cascade: z.boolean(),
});
export type RelationDef = z.infer<typeof relationDefinitionSchema>;

export const entityOptionsSchema = z.strictObject({
  timestamps: z.boolean(),
  softDelete: z.boolean(),
  pagination: z.boolean(),
  searchFields: z.array(camelNameSchema),
  sortFields: z.array(camelNameSchema),
  owner: z.boolean(),
  /** Property name of the managed many-to-one relation to User, when ownership is enabled. */
  ownerRelation: camelNameSchema.optional(),
  multitenant: z.boolean().default(false),
  throttle: throttleOverrideSchema.optional(),
  cache: cacheHintSchema.optional(),
});
export type EntityOptions = z.infer<typeof entityOptionsSchema>;

export const entityDefinitionSchema = z.strictObject({
  id: idSchema,
  name: entityNameSchema,
  description: z.string().max(300).optional(),
  fields: z.array(fieldDefinitionSchema),
  relations: z.array(relationDefinitionSchema),
  options: entityOptionsSchema,
  access: accessMatrixSchema,
  customEndpoints: z.array(customEndpointSchema).default([]),
});
export type EntityDef = z.infer<typeof entityDefinitionSchema>;

export const enumDefinitionSchema = z.strictObject({
  id: idSchema,
  name: enumNameSchema,
  values: z.array(enumValueSchema).min(1).max(64),
});
export type EnumDef = z.infer<typeof enumDefinitionSchema>;

export const STORAGE_DRIVERS = ["local", "s3"] as const;
export const storageDriverSchema = z.enum(STORAGE_DRIVERS);
export type StorageDriver = z.infer<typeof storageDriverSchema>;

export const uploadConfigSchema = z.strictObject({
  enabled: z.boolean(),
  driver: storageDriverSchema,
  maxFileSizeMb: z.number().int().min(1).max(500),
});
export type UploadConfig = z.infer<typeof uploadConfigSchema>;

export const multitenancyConfigSchema = z.strictObject({
  enabled: z.boolean(),
  header: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, digits, or dashes (e.g. x-tenant-id)"),
});
export type MultitenancyConfig = z.infer<typeof multitenancyConfigSchema>;

export const throttlingConfigSchema = z.strictObject({
  enabled: z.boolean().default(true),
  ttl: z.number().int().min(1).max(3600).default(60),
  limit: z.number().int().min(1).max(100000).default(100),
});
export type ThrottlingConfig = z.infer<typeof throttlingConfigSchema>;

export const graphqlConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  playground: z.boolean().default(true),
  path: z.string().min(1).max(100).default("/graphql"),
});
export type GraphQLConfig = z.infer<typeof graphqlConfigSchema>;

export const queueJobSchema = z.strictObject({
  id: idSchema,
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][A-Za-z0-9]*$/, "Use camelCase, e.g. sendWelcomeEmail"),
  description: z.string().max(200).optional(),
  attempts: z.number().int().min(1).max(20).default(3),
  backoffDelayMs: z.number().int().min(0).max(3600000).default(1000),
  backoffType: z.enum(["fixed", "exponential"]).default("exponential"),
});
export type QueueJobDef = z.infer<typeof queueJobSchema>;

export const queueSchema = z.strictObject({
  id: idSchema,
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, digits or dashes, e.g. mail"),
  description: z.string().max(200).optional(),
  concurrency: z.number().int().min(1).max(100).default(1),
  jobs: z.array(queueJobSchema).default([]),
});
export type QueueDef = z.infer<typeof queueSchema>;

export const queuesConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  redisHost: z.string().min(1).max(120).default("localhost"),
  redisPort: z.number().int().min(1).max(65535).default(6379),
  redisPassword: z.string().max(120).optional(),
  queues: z.array(queueSchema).default([]),
});
export type QueuesConfig = z.infer<typeof queuesConfigSchema>;

export const websocketConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  adapter: z.literal("socket.io").default("socket.io"),
  path: z.string().min(1).max(100).default("/events"),
  corsOrigin: z.string().min(1).max(255).default("*"),
  auth: z.boolean().default(true),
  broadcastCrud: z.boolean().default(true),
});
export type WebSocketConfig = z.infer<typeof websocketConfigSchema>;

export const projectSettingsSchema = z.strictObject({
  packageManager: z.literal("npm"),
  apiPrefix: z.string().min(1).max(40).regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, digits or dashes"),
  swagger: z.boolean(),
  docker: z.boolean(),
  tests: z.boolean(),
  uploads: uploadConfigSchema.default({
    enabled: false,
    driver: "local",
    maxFileSizeMb: 10,
  }),
  multitenancy: multitenancyConfigSchema.default({
    enabled: false,
    header: "x-tenant-id",
  }),
  throttling: throttlingConfigSchema.default({
    enabled: true,
    ttl: 60,
    limit: 100,
  }),
  graphql: graphqlConfigSchema.default({
    enabled: false,
    playground: true,
    path: "/graphql",
  }),
  queues: queuesConfigSchema.default({
    enabled: false,
    redisHost: "localhost",
    redisPort: 6379,
    queues: [],
  }),
  websockets: websocketConfigSchema.default({
    enabled: false,
    adapter: "socket.io",
    path: "/events",
    corsOrigin: "*",
    auth: true,
    broadcastCrud: true,
  }),
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const projectSchema = z
  .strictObject({
    id: idSchema,
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(80),
    packageName: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits or dashes"),
    driver: driverSchema,
    auth: authConfigSchema,
    enums: z.array(enumDefinitionSchema),
    entities: z.array(entityDefinitionSchema),
    settings: projectSettingsSchema,
    lastExportPath: z.string().min(1).max(4096).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((project, ctx) => {
    const entityNames = new Set<string>();
    for (const [index, entity] of project.entities.entries()) {
      const key = entity.name.toLowerCase();
      if (entityNames.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["entities", index, "name"],
          message: `Duplicate entity "${entity.name}"`,
        });
      }
      entityNames.add(key);
    }

    const enumNames = new Set<string>();
    for (const [index, enumDef] of project.enums.entries()) {
      const key = enumDef.name.toLowerCase();
      if (enumNames.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["enums", index, "name"],
          message: `Duplicate enum "${enumDef.name}"`,
        });
      }
      enumNames.add(key);
    }
  });
export type Project = z.infer<typeof projectSchema>;

/**
 * Parses a project file persisted by the app. Only schema version 1 exists today;
 * future versions must ship a migration before bumping this literal.
 */
export function migrateProject(raw: unknown): Project {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Project file is not an object");
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (version !== 1) {
    throw new Error(
      `Unsupported project schema version: ${String(version)}. This build supports version 1.`,
    );
  }
  return projectSchema.parse(raw);
}

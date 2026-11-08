import {
  USER_ENTITY_ID,
  buildUserEntity,
  createEntity,
  createField,
  createProject,
  createRelation,
} from "../model/defaults";
import type { Driver, Project } from "../model/schema";
import type { ProjectTemplate } from "./types";

export function createSaaSProject(options?: {
  name?: string;
  packageName?: string;
  driver?: Driver;
}): Project {
  const project = createProject(
    options?.name ?? "SaaS Starter API",
    options?.driver ?? "postgres",
    true,
  );

  if (options?.packageName) {
    project.packageName = options.packageName;
  }

  // Multi-tenancy settings
  project.settings.multitenancy = {
    enabled: true,
    header: "x-tenant-id",
  };

  // Auth configuration
  project.auth = {
    ...project.auth,
    refreshTokens: true,
    sessionManagement: true,
    twoFactor: true,
    emailVerification: true,
    roles: [
      { key: "admin", label: "Admin" },
      { key: "member", label: "Member" },
      { key: "viewer", label: "Viewer" },
    ],
  };

  // Entities
  const user = buildUserEntity();

  const organization = createEntity("Organization");
  organization.id = "ent_org";
  organization.description = "Top-level tenant account representing a company or team.";
  organization.fields = [
    createField("name", "string", { column: { length: 120 } }),
    createField("slug", "string", { unique: true, indexed: true, column: { length: 120 } }),
    createField("billingEmail", "string", { column: { length: 255 } }),
    createField("plan", "string", { defaultValue: "'starter'", column: { length: 50 } }),
  ];
  organization.options.searchFields = ["name", "slug"];
  organization.access = {
    list: { level: "authenticated" },
    read: { level: "authenticated" },
    create: { level: "roles", roles: ["admin"] },
    update: { level: "roles", roles: ["admin"] },
    delete: { level: "roles", roles: ["admin"] },
  };

  const workspace = createEntity("Workspace");
  workspace.id = "ent_workspace";
  workspace.description = "Isolated workspace belonging to the active tenant.";
  workspace.options.multitenant = true;
  workspace.fields = [
    createField("name", "string", { column: { length: 100 } }),
    createField("slug", "string", { indexed: true, column: { length: 100 } }),
    createField("description", "text", { required: false }),
  ];
  workspace.options.searchFields = ["name", "slug"];
  workspace.access = {
    list: { level: "authenticated" },
    read: { level: "authenticated" },
    create: { level: "authenticated" },
    update: { level: "authenticated" },
    delete: { level: "roles", roles: ["admin"] },
  };

  const apiKey = createEntity("ApiKey");
  apiKey.id = "ent_apikey";
  apiKey.description = "API credentials for programmatic tenant access.";
  apiKey.options.multitenant = true;
  apiKey.options.owner = true;
  apiKey.options.ownerRelation = "owner";
  apiKey.fields = [
    createField("name", "string", { column: { length: 100 } }),
    createField("keyPrefix", "string", { column: { length: 12 } }),
    createField("keyHash", "string", { indexed: true, column: { length: 64 } }),
    createField("lastUsedAt", "datetime", { required: false }),
  ];
  apiKey.relations = [
    createRelation("owner", USER_ENTITY_ID, "many-to-one", { nullable: false }),
  ];
  apiKey.options.searchFields = ["name", "keyPrefix"];
  apiKey.access = {
    list: { level: "owner" },
    read: { level: "owner" },
    create: { level: "authenticated" },
    update: { level: "owner" },
    delete: { level: "owner" },
  };

  const auditLog = createEntity("AuditLog");
  auditLog.id = "ent_auditlog";
  auditLog.description = "Security and activity trail recorded within the tenant.";
  auditLog.options.multitenant = true;
  auditLog.options.owner = true;
  auditLog.options.ownerRelation = "owner";
  auditLog.fields = [
    createField("action", "string", { indexed: true, column: { length: 100 } }),
    createField("resource", "string", { column: { length: 100 } }),
    createField("details", "json", { required: false }),
    createField("ipAddress", "string", { required: false, column: { length: 45 } }),
  ];
  auditLog.relations = [
    createRelation("owner", USER_ENTITY_ID, "many-to-one", { nullable: false }),
  ];
  auditLog.options.searchFields = ["action", "resource"];
  auditLog.access = {
    list: { level: "roles", roles: ["admin"] },
    read: { level: "roles", roles: ["admin"] },
    create: { level: "authenticated" },
    update: { level: "roles", roles: ["admin"] },
    delete: { level: "roles", roles: ["admin"] },
  };

  project.entities = [user, organization, workspace, apiKey, auditLog];
  return project;
}

export const saasTemplate: ProjectTemplate = {
  id: "saas",
  title: "SaaS Starter",
  category: "saas",
  tagline: "Multi-tenant B2B subscription platform",
  description:
    "Production-ready multi-tenant foundation featuring header-based isolation, workspaces, owner-scoped API keys, audit trails, and role-based access control.",
  icon: "Layers",
  features: [
    "Tenant isolation (x-tenant-id)",
    "Workspaces & Organizations",
    "API Key Management",
    "Security Audit Trails",
    "Active Sessions & 2FA",
  ],
  entities: ["Organization", "Workspace", "ApiKey", "AuditLog"],
  createProject: createSaaSProject,
};

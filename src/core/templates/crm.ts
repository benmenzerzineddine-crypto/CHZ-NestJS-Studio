import {
  USER_ENTITY_ID,
  buildUserEntity,
  createEntity,
  createEnum,
  createField,
  createProject,
  createRelation,
} from "../model/defaults";
import type { Driver, Project } from "../model/schema";
import type { ProjectTemplate } from "./types";

export function createCrmProject(options?: {
  name?: string;
  packageName?: string;
  driver?: Driver;
}): Project {
  const project = createProject(
    options?.name ?? "CRM Starter API",
    options?.driver ?? "postgres",
    true,
  );

  if (options?.packageName) {
    project.packageName = options.packageName;
  }

  // Auth configuration
  project.auth = {
    ...project.auth,
    refreshTokens: true,
    sessionManagement: true,
    roles: [
      { key: "admin", label: "Admin" },
      { key: "manager", label: "Sales Manager" },
      { key: "rep", label: "Sales Rep" },
    ],
  };

  // Enums
  const dealStageEnum = createEnum("DealStage", [
    "lead",
    "qualified",
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
  ]);
  dealStageEnum.id = "enm_dealstage";

  const activityTypeEnum = createEnum("ActivityType", [
    "call",
    "email",
    "meeting",
    "note",
  ]);
  activityTypeEnum.id = "enm_activitytype";

  project.enums = [dealStageEnum, activityTypeEnum];

  // Entities
  const user = buildUserEntity();

  const company = createEntity("Company");
  company.id = "ent_company";
  company.description = "B2B client account or prospect organization.";
  company.fields = [
    createField("name", "string", { column: { length: 120 } }),
    createField("website", "string", { required: false, column: { length: 200 } }),
    createField("phone", "string", { required: false, column: { length: 40 } }),
    createField("industry", "string", { required: false, column: { length: 60 } }),
  ];
  company.options.searchFields = ["name", "industry"];
  company.access = {
    list: { level: "authenticated" },
    read: { level: "authenticated" },
    create: { level: "authenticated" },
    update: { level: "authenticated" },
    delete: { level: "roles", roles: ["admin", "manager"] },
  };

  const contact = createEntity("Contact");
  contact.id = "ent_contact";
  contact.description = "Individual prospect or customer representative.";
  contact.fields = [
    createField("firstName", "string", { column: { length: 60 } }),
    createField("lastName", "string", { column: { length: 60 } }),
    createField("email", "string", { unique: true, indexed: true, column: { length: 160 } }),
    createField("phone", "string", { required: false, column: { length: 40 } }),
    createField("jobTitle", "string", { required: false, column: { length: 80 } }),
  ];
  contact.relations = [
    createRelation("company", company.id, "many-to-one", { nullable: true }),
  ];
  contact.options.searchFields = ["firstName", "lastName", "email"];
  contact.access = {
    list: { level: "authenticated" },
    read: { level: "authenticated" },
    create: { level: "authenticated" },
    update: { level: "authenticated" },
    delete: { level: "roles", roles: ["admin", "manager"] },
  };

  const deal = createEntity("Deal");
  deal.id = "ent_deal";
  deal.description = "Revenue opportunity tracked across sales pipeline stages.";
  deal.options.owner = true;
  deal.options.ownerRelation = "owner";
  deal.fields = [
    createField("title", "string", { column: { length: 120 } }),
    createField("amount", "decimal", { column: { precision: 12, scale: 2 } }),
    createField("stage", "enum", { enumId: dealStageEnum.id, defaultValue: "'lead'" }),
    createField("closeDate", "date", { required: false }),
  ];
  deal.relations = [
    createRelation("company", company.id, "many-to-one", { nullable: true }),
    createRelation("owner", USER_ENTITY_ID, "many-to-one", { nullable: false }),
  ];
  deal.options.searchFields = ["title"];
  deal.access = {
    list: { level: "authenticated" },
    read: { level: "authenticated" },
    create: { level: "authenticated" },
    update: { level: "owner" },
    delete: { level: "roles", roles: ["admin", "manager"] },
  };

  const activity = createEntity("Activity");
  activity.id = "ent_activity";
  activity.description = "Touchpoint, communication, or follow-up task.";
  activity.options.owner = true;
  activity.options.ownerRelation = "assignee";
  activity.fields = [
    createField("type", "enum", { enumId: activityTypeEnum.id, defaultValue: "'note'" }),
    createField("subject", "string", { column: { length: 160 } }),
    createField("notes", "text", { required: false }),
    createField("scheduledAt", "datetime", { required: false }),
  ];
  activity.relations = [
    createRelation("deal", deal.id, "many-to-one", { nullable: true }),
    createRelation("contact", contact.id, "many-to-one", { nullable: true }),
    createRelation("assignee", USER_ENTITY_ID, "many-to-one", { nullable: false }),
  ];
  activity.options.searchFields = ["subject"];
  activity.access = {
    list: { level: "owner" },
    read: { level: "owner" },
    create: { level: "authenticated" },
    update: { level: "owner" },
    delete: { level: "owner" },
  };

  project.entities = [user, company, contact, deal, activity];
  return project;
}

export const crmTemplate: ProjectTemplate = {
  id: "crm",
  title: "CRM Starter",
  category: "crm",
  tagline: "Pipeline & customer relationship management",
  description:
    "Comprehensive sales CRM with business accounts, contacts, deal pipeline stages, and rep activity tracking with assignment and owner permissions.",
  icon: "Building2",
  features: [
    "Accounts & Contacts",
    "Deal Pipeline Tracking",
    "Sales Activity & Task Logs",
    "Representative Ownership",
    "Manager & Rep Roles",
  ],
  entities: ["Company", "Contact", "Deal", "Activity"],
  createProject: createCrmProject,
};

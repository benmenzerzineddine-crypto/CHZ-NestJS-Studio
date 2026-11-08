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

export function createBlogProject(options?: {
  name?: string;
  packageName?: string;
  driver?: Driver;
}): Project {
  const project = createProject(
    options?.name ?? "Blog & CMS API",
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
      { key: "admin", label: "Administrator" },
      { key: "user", label: "User" },
      { key: "editor", label: "Editor" },
    ],
  };

  // Enums
  const postStatusEnum = createEnum("PostStatus", [
    "draft",
    "published",
    "archived",
  ]);
  postStatusEnum.id = "enm_poststatus";
  project.enums = [postStatusEnum];

  // Entities
  const user = buildUserEntity();

  const tag = createEntity("Tag");
  tag.id = "ent_tag";
  tag.description = "Topic taxonomy for categorizing articles.";
  tag.fields = [
    createField("name", "string", { column: { length: 40 } }),
    createField("slug", "string", { unique: true, indexed: true, column: { length: 40 } }),
  ];
  tag.options.searchFields = ["name", "slug"];
  tag.access = {
    list: { level: "public" },
    read: { level: "public" },
    create: { level: "roles", roles: ["admin", "editor"] },
    update: { level: "roles", roles: ["admin", "editor"] },
    delete: { level: "roles", roles: ["admin", "editor"] },
  };

  const post = createEntity("Post");
  post.id = "ent_post";
  post.description = "A published article written by a user.";
  post.options.owner = true;
  post.options.ownerRelation = "author";
  post.fields = [
    createField("title", "string", { column: { length: 160 }, validators: { minLength: 3, maxLength: 160 } }),
    createField("slug", "string", { unique: true, indexed: true, column: { length: 180 }, validators: { maxLength: 180 } }),
    createField("content", "text", { validators: { minLength: 1 } }),
    createField("status", "enum", { enumId: postStatusEnum.id, defaultValue: "'draft'" }),
  ];
  post.relations = [
    createRelation("author", USER_ENTITY_ID, "many-to-one", { nullable: false }),
    createRelation("tags", tag.id, "many-to-many"),
  ];
  post.options.searchFields = ["title", "slug"];
  post.access = {
    list: { level: "public" },
    read: { level: "public" },
    create: { level: "authenticated" },
    update: { level: "owner" },
    delete: { level: "roles", roles: ["admin"] },
  };

  const comment = createEntity("Comment");
  comment.id = "ent_comment";
  comment.description = "Feedback left on a published post.";
  comment.options.owner = true;
  comment.options.ownerRelation = "author";
  comment.fields = [
    createField("content", "text", { validators: { minLength: 1, maxLength: 2000 } }),
    createField("approved", "boolean", { defaultValue: "true" }),
  ];
  comment.relations = [
    createRelation("post", post.id, "many-to-one", { nullable: false, cascade: true }),
    createRelation("author", USER_ENTITY_ID, "many-to-one", { nullable: false }),
  ];
  comment.access = {
    list: { level: "public" },
    read: { level: "public" },
    create: { level: "authenticated" },
    update: { level: "owner" },
    delete: { level: "roles", roles: ["admin"] },
  };

  project.entities = [user, post, tag, comment];
  return project;
}

export const blogTemplate: ProjectTemplate = {
  id: "blog",
  title: "Blog & CMS Starter",
  category: "cms",
  tagline: "Publishing platform with articles, tags, and comments",
  description:
    "Content publishing architecture with articles, slug routing, many-to-many tag taxonomies, reader comments, and editorial moderation workflows.",
  icon: "FileText",
  features: [
    "Article Publishing Workflow",
    "Many-to-Many Tag Taxonomy",
    "Reader Discussion & Comments",
    "Author Edit Scoping",
    "Editorial & Admin Roles",
  ],
  entities: ["Post", "Tag", "Comment"],
  createProject: createBlogProject,
};

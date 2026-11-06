import { describe, expect, it } from "vitest";
import { createEntity, createField, createProject } from "../model/defaults";
import { projectSchema } from "../model/schema";
import blogJson from "../fixtures/blog.json";
import { buildIR, IrBuildError } from "./build";

const blog = projectSchema.parse(blogJson);

describe("buildIR", () => {
  it("builds the blog fixture with stable names and ownership", () => {
    const ir = buildIR(blog);
    expect(ir.driver).toBe("postgres");
    expect(ir.enums[0]).toMatchObject({
      name: "PostStatus",
      members: ["Draft", "Published", "Archived"],
    });
    expect(ir.entityById.get("ent_post")).toMatchObject({
      singularKebab: "post",
      pluralKebab: "posts",
      restPath: "posts",
      tableName: "posts",
      moduleDir: "src/modules/post",
    });
    expect(ir.entityById.get("ent_post")?.ownerColumn).toBe("ownerId");
    expect(ir.entityById.get("ent_post")?.ownerRelation?.target.name).toBe("User");
    expect(ir.entityById.get("ent_post")?.softDelete).toBe(true);
  });

  it("derives inverses without generating stored one-to-many relations", () => {
    const ir = buildIR(blog);
    const user = ir.entityById.get("ent_user");
    const post = ir.entityById.get("ent_post");
    expect(user?.relations).toHaveLength(0);
    expect(user?.derivedRelations.map((relation) => relation.name)).toEqual([
      "posts",
      "postsAsOwner",
      "comments",
    ]);
    expect(post?.derivedRelations.map((relation) => relation.name)).toContain("comments");
    expect(post?.relations.find((relation) => relation.name === "tags")).toMatchObject({
      kind: "many-to-many",
      joinTableName: "posts_tags",
      fkType: "string",
    });
  });

  it("adds an implicit uuid primary key when a model has no primary field", () => {
    const project = createProject("Implicit");
    project.entities.push(createEntity("Note"));
    const ir = buildIR(project);
    const note = ir.entityById.get(ir.entities.find((entity) => entity.name === "Note")?.id ?? "");
    expect(note?.implicitPrimary).toBe(true);
    expect(note?.primary).toMatchObject({ name: "id", type: "uuid", generated: true });
  });

  it("keeps an explicit primary key and its scalar type", () => {
    const project = createProject("Explicit");
    const entity = createEntity("Counter");
    entity.fields.push(createField("code", "int", { primary: true }));
    project.entities.push(entity);
    const ir = buildIR(project);
    const counter = ir.entities.find((candidate) => candidate.name === "Counter");
    expect(counter?.implicitPrimary).toBe(false);
    expect(counter?.primary).toMatchObject({ name: "code", type: "int", generated: false });
  });

  it("forces timestamps and soft delete on the built-in User", () => {
    const project = createProject("Users");
    const user = project.entities[0];
    user.options.timestamps = false;
    user.options.softDelete = false;
    const ir = buildIR(project);
    expect(ir.user).toMatchObject({ timestamps: true, softDelete: true });
  });

  it("rejects relations that collide with generated columns", () => {
    const project = createProject("Collision");
    project.entities.push(createEntity("Note"));
    const note = project.entities.find((entity) => entity.name === "Note");
    if (!note) throw new Error("missing note");
    note.fields.push(createField("createdAt", "datetime"));
    expect(() => buildIR(project)).toThrow(IrBuildError);
  });

  it("rejects entities whose plural table names collide", () => {
    const project = createProject("Collision");
    project.entities.push(createEntity("Category"), createEntity("Categories"));
    expect(() => buildIR(project)).toThrow(/REST path/);
  });

  it("rejects stored one-to-many relations", () => {
    const project = createProject("Stored");
    const parent = createEntity("Parent");
    const child = createEntity("Child");
    parent.relations.push({
      id: "rel_children",
      name: "children",
      targetEntityId: child.id,
      kind: "one-to-many",
      nullable: false,
      cascade: false,
    });
    project.entities.push(parent, child);
    expect(() => buildIR(project)).toThrow(/stored as one-to-many/);
  });
});

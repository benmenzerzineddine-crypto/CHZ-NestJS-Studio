// @vitest-environment node
import { describe, expect, it } from "vitest";
import blogJson from "../fixtures/blog.json";
import { buildIR } from "../ir/build";
import { createEntity, createField, createProject, createRelation } from "../model/defaults";
import { projectSchema } from "../model/schema";
import { emitSeed } from "./seed";

const blog = projectSchema.parse(blogJson);

function seedFor(project = blog): string {
  return emitSeed(buildIR(project)).content;
}

describe("generated seed", () => {
  it("is deterministic for the same model", () => {
    expect(seedFor()).toBe(seedFor());
  });

  it("emits three upserted sample rows per custom entity", () => {
    const content = seedFor();

    expect(content).toContain('process.env.SEED_ADMIN !== "false"');
    expect(content).toContain("const postRows");
    expect(content).toContain("const tagRows");
    expect(content).toContain("const commentRows");
    expect(content.match(/upsert\(/g)).toHaveLength(3);
    expect(content).toContain("PostStatus.Draft");
    expect(content).toContain("PostStatus.Published");
    expect(content).toContain("PostStatus.Archived");
  });

  it("links many-to-many rows only after both entities exist", () => {
    const content = seedFor();
    const postRows = content.indexOf("const postRows");
    const tagRows = content.indexOf("const tagRows");
    const join = content.indexOf('.into("posts_tags")');

    expect(tagRows).toBeGreaterThan(postRows);
    expect(join).toBeGreaterThan(tagRows);
    expect(content).toContain('.orIgnore()');
  });

  it("resets join tables and entities in a safe order, guarded from production", () => {
    const content = seedFor();
    const reset = content.slice(content.indexOf("if (RESET)"), content.indexOf("const users ="));
    const join = reset.indexOf('"posts_tags"');
    const posts = reset.indexOf('"posts"');

    expect(join).toBeGreaterThan(-1);
    expect(posts).toBeGreaterThan(join);
    expect(content).toContain("--reset is not allowed in production.");
  });

  it("does not require an admin when no required user relation exists", () => {
    const project = createProject("Simple API");
    const note = createEntity("Note");
    note.fields.push(createField("body", "text"));
    project.entities.push(note);

    const content = seedFor(project);

    expect(content).toContain("const noteRows");
    expect(content).not.toContain("Seed data needs the admin user.");
  });

  it("fails clearly for cyclic required relations", () => {
    const project = createProject("Cycle API");
    const first = createEntity("First");
    const second = createEntity("Second");
    first.relations.push(createRelation("second", second.id, "many-to-one", { nullable: false }));
    second.relations.push(createRelation("first", first.id, "many-to-one", { nullable: false }));
    project.entities.push(first, second);

    const content = seedFor(project);

    expect(content).toContain("Seed cannot order cyclic required relations");
  });
});

describe("seed relation ordering", () => {
  it("does not point a row at a target that has not been inserted yet", () => {
    const project = createProject("Forward API");
    const first = createEntity("First");
    const second = createEntity("Second");
    first.relations.push(createRelation("second", second.id, "many-to-one", { nullable: true }));
    project.entities.push(first, second);

    const content = seedFor(project);

    expect(content).toContain("const firstRows");
    expect(content).not.toContain('secondId: "00000000-0000-4000-8000-000000001011"');
  });
});

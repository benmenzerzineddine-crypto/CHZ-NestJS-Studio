// @vitest-environment node
import { describe, expect, it } from "vitest";
import blogJson from "../fixtures/blog.json";
import { buildIR } from "../ir/build";
import { projectSchema, type Project } from "../model/schema";
import { emitTests } from "./tests";

const blog = projectSchema.parse(blogJson);

function paths(project: Project): Set<string> {
  return new Set(emitTests(buildIR(project)).map((file) => file.path));
}

describe("generated e2e specs", () => {
  it("emits shared helpers and one CRUD spec per buildable entity", () => {
    const files = paths(blog);

    expect(files).toContain("test/utils/auth.ts");
    expect(files).toContain("test/utils/db.ts");
    expect(files).toContain("test/utils/factories.ts");
    expect(files).toContain("test/post.e2e-spec.ts");
    expect(files).toContain("test/tag.e2e-spec.ts");
    expect(files).toContain("test/comment.e2e-spec.ts");
    expect(files).not.toContain("test/user.e2e-spec.ts");
  });

  it("covers CRUD, query bounds, filters and soft-delete restore", () => {
    const spec = emitTests(buildIR(blog)).find(
      (file) => file.path === "test/post.e2e-spec.ts",
    );
    if (!spec) throw new Error("Missing Post spec");

    for (const expected of [
      "creates a Post",
      "lists Post records",
      "reads a Post",
      "updates a Post",
      "deletes and restores a Post",
      "rejects invalid Post input",
      "returns 404 for a missing Post",
      "?limit=101",
      "?sort=__not_a_field__",
      "?title=",
      "withDeleted=true",
      "restore",
    ]) {
      expect(spec.content).toContain(expected);
    }
  });

  it("uses the generated factories instead of duplicating payload builders", () => {
    const files = emitTests(buildIR(blog));
    const authz = files.find((file) => file.path === "test/authorization.e2e-spec.ts");
    const factories = files.find((file) => file.path === "test/utils/factories.ts");
    if (!authz || !factories) throw new Error("Missing authorization helpers");

    expect(authz.content).toContain("createFactories");
    expect(authz.content).toContain("factory.makePost");
    expect(authz.content).not.toContain("async function makePost");
    expect(factories.content).toContain("buildPost");
    expect(factories.content).toContain("sampleString");
  });

  it("returns no test files when generated tests are disabled", () => {
    const project = structuredClone(blog);
    project.settings.tests = false;

    expect(emitTests(buildIR(project))).toEqual([]);
  });
});

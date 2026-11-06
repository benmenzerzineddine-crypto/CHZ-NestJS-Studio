import { describe, expect, it } from "vitest";
import { migrateProject, projectSchema } from "../model/schema";
import { toRestPath } from "../model/naming";
import { buildDerivedInverses } from "../model/normalize";
import { validateProject } from "../validate/validate";
import blog from "./blog.json";

describe("blog fixture", () => {
  it("matches the project schema", () => {
    const project = projectSchema.parse(blog);

    expect(project.entities.map((entity) => entity.name)).toEqual([
      "User",
      "Post",
      "Tag",
      "Comment",
    ]);
    expect(project.enums[0]?.values).toEqual(["draft", "published", "archived"]);
  });

  it("validates with zero errors and warnings", () => {
    const project = migrateProject(blog);

    expect(validateProject(project)).toEqual([]);
  });

  it("mixes public reads with owner and role writes", () => {
    const project = projectSchema.parse(blog);
    const post = project.entities.find((entity) => entity.name === "Post");
    const tag = project.entities.find((entity) => entity.name === "Tag");

    expect(post?.access.list.level).toBe("public");
    expect(post?.access.update.level).toBe("owner");
    expect(post?.access.delete.roles).toEqual(["admin"]);
    expect(tag?.access.create.roles).toEqual(["admin", "editor"]);
    expect(toRestPath("Post")).toBe("posts");
  });

  it("keeps ownership relations pointing at User", () => {
    const project = projectSchema.parse(blog);
    const post = project.entities.find((entity) => entity.name === "Post");
    const owner = post?.relations.find(
      (relation) => relation.name === post.options.ownerRelation,
    );

    expect(post?.options.owner).toBe(true);
    expect(owner).toMatchObject({ targetEntityId: "ent_user", kind: "many-to-one" });
  });

  it("derives the Post.comments inverse from Comment.post", () => {
    const project = projectSchema.parse(blog);
    const post = project.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post");

    const inverses = buildDerivedInverses(project.entities)
      .filter((inverse) => inverse.targetEntityId === post.id)
      .map((inverse) => inverse.name);

    expect(inverses).toContain("comments");
  });
});

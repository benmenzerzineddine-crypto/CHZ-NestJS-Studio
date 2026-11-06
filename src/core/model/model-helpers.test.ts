import { describe, expect, it } from "vitest";
import { createEntity } from "./defaults";
import { toCamelCase, toKebabCase, toPascalCase, toRestPath, toTableName } from "./naming";
import { buildDerivedInverses } from "./normalize";

describe("naming", () => {
  it("converts identifiers", () => {
    expect(toKebabCase("BlogPost")).toBe("blog-post");
    expect(toKebabCase("APIKey")).toBe("api-key");
    expect(toPascalCase("blog post")).toBe("BlogPost");
    expect(toPascalCase("blog_post")).toBe("BlogPost");
    expect(toCamelCase("Blog Post")).toBe("blogPost");
  });

  it("derives REST paths and table names", () => {
    expect(toRestPath("BlogPost")).toBe("blog-posts");
    expect(toRestPath("Category")).toBe("categories");
    expect(toTableName("BlogPost")).toBe("blog_posts");
  });
});

describe("derived inverse relations", () => {
  it("derives one-to-many inverses for many-to-one relations", () => {
    const user = createEntity("User");
    const post = createEntity("Post");
    post.relations.push({
      id: "rel_author",
      name: "author",
      targetEntityId: user.id,
      kind: "many-to-one",
      nullable: false,
      cascade: false,
    });

    const inverses = buildDerivedInverses([user, post]);
    const inverse = inverses.find((entry) => entry.targetEntityId === user.id);

    expect(inverse).toMatchObject({ name: "posts", kind: "one-to-many" });
  });

  it("disambiguates multiple relations to the same entity", () => {
    const user = createEntity("User");
    const post = createEntity("Post");
    post.relations.push(
      {
        id: "rel_author",
        name: "author",
        targetEntityId: user.id,
        kind: "many-to-one",
        nullable: false,
        cascade: false,
      },
      {
        id: "rel_owner",
        name: "owner",
        targetEntityId: user.id,
        kind: "many-to-one",
        nullable: true,
        cascade: false,
      },
    );

    const names = buildDerivedInverses([user, post])
      .filter((entry) => entry.targetEntityId === user.id)
      .map((entry) => entry.name);

    expect(names).toEqual(["posts", "postsAsOwner"]);
  });

  it("derives many-to-many inverses", () => {
    const post = createEntity("Post");
    const tag = createEntity("Tag");
    post.relations.push({
      id: "rel_tags",
      name: "tags",
      targetEntityId: tag.id,
      kind: "many-to-many",
      nullable: false,
      cascade: false,
    });

    const [inverse] = buildDerivedInverses([post, tag]).filter(
      (entry) => entry.targetEntityId === tag.id,
    );

    expect(inverse).toMatchObject({ name: "posts", kind: "many-to-many" });
  });
});

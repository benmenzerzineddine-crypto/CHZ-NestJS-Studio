import { describe, expect, it } from "vitest";
import { validateProject } from "../validate/validate";
import { parseSqlDdl } from "./sql-ddl";

describe("parseSqlDdl", () => {
  it("parses PostgreSQL DDL with tables, columns, constraints and foreign keys", () => {
    const sql = `
      CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');

      CREATE TABLE users (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        bio TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      );

      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        views INT DEFAULT 0,
        status post_status NOT NULL,
        is_featured BOOLEAN DEFAULT FALSE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE comments (
        id INT PRIMARY KEY,
        message TEXT NOT NULL,
        post_id INT NOT NULL,
        FOREIGN KEY (post_id) REFERENCES posts(id)
      );
    `;

    const project = parseSqlDdl(sql, { projectName: "Blog SQL API", driver: "postgres" });

    expect(project.name).toBe("Blog SQL API");
    expect(project.driver).toBe("postgres");

    // Enums
    expect(project.enums.length).toBe(1);
    expect(project.enums[0].name).toBe("PostStatusEnum");
    expect(project.enums[0].values).toEqual(["draft", "published", "archived"]);

    // Entities: User, Post, Comment
    expect(project.entities.length).toBe(3); // User (system), Post, Comment

    const userEntity = project.entities.find((e) => e.name === "User");
    expect(userEntity).toBeDefined();
    expect(userEntity?.fields.some((f) => f.name === "name")).toBe(true);

    const postEntity = project.entities.find((e) => e.name === "Post");
    expect(postEntity).toBeDefined();
    expect(postEntity?.options.timestamps).toBe(true);
    expect(postEntity?.options.softDelete).toBe(true);
    expect(postEntity?.options.owner).toBe(true);

    const titleField = postEntity?.fields.find((f) => f.name === "title");
    expect(titleField?.type).toBe("string");
    expect(titleField?.required).toBe(true);

    const statusField = postEntity?.fields.find((f) => f.name === "status");
    expect(statusField?.type).toBe("enum");
    expect(statusField?.enumId).toBe(project.enums[0].id);

    // Foreign key relation from Post to User
    const authorRel = postEntity?.relations.find((r) => r.name === "author");
    expect(authorRel).toBeDefined();
    expect(authorRel?.targetEntityId).toBe(userEntity?.id);
    expect(authorRel?.cascade).toBe(true);

    // Relation from Comment to Post
    const commentEntity = project.entities.find((e) => e.name === "Comment");
    expect(commentEntity).toBeDefined();
    const postRel = commentEntity?.relations.find((r) => r.name === "post");
    expect(postRel).toBeDefined();
    expect(postRel?.targetEntityId).toBe(postEntity?.id);

    // Validate project semantic checks
    const issues = validateProject(project);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("parses MySQL DDL with backticks and ALTER TABLE constraints", () => {
    const sql = `
      CREATE TABLE \`categories\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`slug\` varchar(255) UNIQUE NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;

      CREATE TABLE \`products\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`title\` varchar(255) NOT NULL,
        \`price\` decimal(10,2) NOT NULL,
        \`category_id\` int(11) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;

      ALTER TABLE \`products\` ADD CONSTRAINT \`fk_prod_cat\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`);
    `;

    const project = parseSqlDdl(sql, { projectName: "Store API", driver: "mysql" });
    expect(project.driver).toBe("mysql");

    const category = project.entities.find((e) => e.name === "Category");
    const product = project.entities.find((e) => e.name === "Product");

    expect(category).toBeDefined();
    expect(product).toBeDefined();

    const priceField = product?.fields.find((f) => f.name === "price");
    expect(priceField?.type).toBe("decimal");

    const catRel = product?.relations.find((r) => r.name === "category");
    expect(catRel).toBeDefined();
    expect(catRel?.targetEntityId).toBe(category?.id);

    const issues = validateProject(project);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import blogJson from "./fixtures/blog.json";
import { generateProject } from "./generate";
import { projectSchema, type Project } from "./model/schema";

const blog: Project = projectSchema.parse(blogJson);

function cloneBlog(overrides: (project: Project) => void): Project {
  const project = structuredClone(blog);
  overrides(project);
  return project;
}

describe("generateProject", () => {
  it("emits the full blog project with stable metadata", async () => {
    const result = await generateProject(blog);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.stats.fileCount).toBe(result.files.length);
    expect(result.stats.fileCount).toBeGreaterThan(60);
    expect(result.files.map((file) => file.path)).toEqual(
      [...result.files.map((file) => file.path)].sort((a, b) => a.localeCompare(b)),
    );
    expect(result.tree.name).toBe(blog.packageName);
  });

  it("contains the complete plan tree", async () => {
    const result = await generateProject(blog);
    const paths = new Set(result.files.map((file) => file.path));
    for (const path of [
      "package.json",
      "tsconfig.json",
      "nest-cli.json",
      ".env.example",
      "Dockerfile",
      "docker-compose.yml",
      "README.md",
      "src/main.ts",
      "src/app.module.ts",
      "src/config/typeorm.config.ts",
      "src/database/data-source.ts",
      "src/database/seeds/seed.ts",
      "src/common/enums.ts",
      "src/common/dto/pagination-query.dto.ts",
      "src/health/health.controller.ts",
      "src/auth/auth.module.ts",
      "src/auth/auth.service.ts",
      "src/auth/auth.controller.ts",
      "src/auth/guards/jwt-auth.guard.ts",
      "src/users/entities/user.entity.ts",
      "src/users/entities/refresh-token.entity.ts",
      "src/users/users.service.ts",
      "src/modules/post/post.entity.ts",
      "src/modules/post/dto/create-post.dto.ts",
      "src/modules/post/dto/update-post.dto.ts",
      "src/modules/post/dto/query-post.dto.ts",
      "src/modules/post/post.service.ts",
      "src/modules/post/post.controller.ts",
      "src/modules/post/post.module.ts",
    ]) {
      expect(paths.has(path), path).toBe(true);
    }
  });

  it("selects access decorators from the access matrix", async () => {
    const result = await generateProject(blog);
    const post = result.files.find((file) => file.path === "src/modules/post/post.controller.ts")
      ?.content;
    const tag = result.files.find((file) => file.path === "src/modules/tag/tag.controller.ts")
      ?.content;
    const user = result.files.find((file) => file.path === "src/users/entities/user.entity.ts")
      ?.content;

    expect(post).toContain("@Public()");
    expect(post).toContain("@ApiBearerAuth()");
    expect(tag).toContain('@Roles("admin", "editor")');
    expect(user).toContain("@Exclude()");
    expect(user).toContain("select: false");
    expect(user).toContain("passwordHash");
  });

  it("returns issues and zero files for an invalid project", async () => {
    const invalid = cloneBlog((project) => {
      project.packageName = "Bad Package Name";
    });
    const result = await generateProject(invalid);
    expect(result.files).toEqual([]);
    expect(result.stats.fileCount).toBe(0);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("is deterministic across runs", async () => {
    const first = await generateProject(blog);
    const second = await generateProject(blog);
    expect(second.files).toEqual(first.files);
  });

  it("omits auth guards and users controller when auth is disabled", async () => {
    const project = cloneBlog((candidate) => {
      candidate.auth.enabled = false;
    });
    const result = await generateProject(project);
    const app = result.files.find((file) => file.path === "src/app.module.ts")?.content;
    const users = result.files.find((file) => file.path === "src/users/users.module.ts")?.content;
    expect(app).not.toContain("JwtAuthGuard");
    expect(app).not.toContain("AuthModule");
    expect(users).not.toContain("UsersController");
    expect(result.files.some((file) => file.path === "src/health/health.controller.ts")).toBe(true);
  });

  it("omits admin user routes when adminUserEndpoints is off", async () => {
    const project = cloneBlog((candidate) => {
      candidate.auth.adminUserEndpoints = false;
    });
    const result = await generateProject(project);
    const users = result.files.find((file) => file.path === "src/users/users.controller.ts")?.content;
    expect(users).toBeDefined();
    expect(users).not.toContain("@Get()");
    expect(users).not.toContain("@Patch(':id/roles')");
    expect(users).toContain('@Post("change-password")');
  });

  it("keeps sample seeds when auth seeding and generated tests are disabled", async () => {
    const project = cloneBlog((candidate) => {
      candidate.settings.tests = false;
      candidate.auth.seedAdmin = false;
    });
    const result = await generateProject(project);
    const packageJson = result.files.find((file) => file.path === "package.json")?.content;
    const readme = result.files.find((file) => file.path === "README.md")?.content;
    const seed = result.files.find((file) => file.path === "src/database/seeds/seed.ts")?.content;
    expect(packageJson).toBeDefined();
    expect(JSON.parse(packageJson ?? "{}").scripts.seed).toBe("ts-node src/database/seeds/seed.ts");
    expect(seed).toContain("Seed complete");
    expect(seed).toContain("const SEED_ADMIN = false &&");
    expect(readme).toContain("npm run seed");
  });

  it("memoizes generation for the same model", async () => {
    const first = await generateProject(blog);
    const second = await generateProject(blog);
    expect(second).toBe(first);
  });

  it("snapshots the postgres blog tree", async () => {
    const result = await generateProject(blog);
    expect(result.files.map(({ path, content }) => ({ path, content }))).toMatchSnapshot();
  });

  it("snapshots the sqlite blog tree", async () => {
    const project = cloneBlog((candidate) => {
      candidate.driver = "sqlite";
    });
    const result = await generateProject(project);
    expect(result.files.map(({ path, content }) => ({ path, content }))).toMatchSnapshot();
  });

  it("snapshots auth-disabled wiring", async () => {
    const project = cloneBlog((candidate) => {
      candidate.auth.enabled = false;
    });
    const result = await generateProject(project);
    const selected = result.files
      .filter((file) =>
        ["src/main.ts", "src/app.module.ts", "src/health/health.controller.ts", "src/users/users.module.ts"].includes(
          file.path,
        ),
      )
      .map(({ path, content }) => ({ path, content }));
    expect(selected).toMatchSnapshot();
  });

  it("snapshots admin-disabled user routes", async () => {
    const project = cloneBlog((candidate) => {
      candidate.auth.adminUserEndpoints = false;
    });
    const result = await generateProject(project);
    const users = result.files.find((file) => file.path === "src/users/users.controller.ts");
    expect(users ? { path: users.path, content: users.content } : null).toMatchSnapshot();
  });
});

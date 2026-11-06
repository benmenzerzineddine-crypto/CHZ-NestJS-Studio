import { describe, expect, it } from "vitest";
import blogJson from "../fixtures/blog.json";
import { buildIR } from "../ir/build";
import { createEntity, createField, createProject, createRelation } from "../model/defaults";
import { projectSchema } from "../model/schema";
import { emitAuth } from "./auth";
import { emitCreateDto, emitQueryDto } from "./dto";
import { emitEntity } from "./entity";
import { emitService } from "./service";
import { emitTests } from "./tests";
import { emitUsers } from "./users";

const blog = projectSchema.parse(blogJson);

describe("generated hardening", () => {
  it("uses the target primary key when loading many-to-many relations", () => {
    const project = createProject("Relations");
    const tag = createEntity("Tag");
    tag.fields.push(createField("code", "int", { primary: true }));
    const post = createEntity("Post");
    post.fields.push(createField("title", "string"));
    post.relations.push(createRelation("tags", tag.id, "many-to-many"));
    project.entities.push(tag, post);

    const ir = buildIR(project);
    const postIr = ir.entities.find((entity) => entity.name === "Post");
    if (!postIr) throw new Error("Missing Post IR");
    expect(emitService(ir, postIr).content).toContain(
      "findBy({ code: In(dto.tagsIds) })",
    );
  });

  it("emits nullable dates that can be cleared explicitly", () => {
    const ir = buildIR(blog);
    const post = ir.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post IR");

    expect(emitEntity(ir, post).content).toContain("publishedAt?: Date | null;");
    expect(emitCreateDto(ir, post).content).toContain("publishedAt?: string | null;");
    expect(emitQueryDto(ir, post).content).toContain("publishedAt?: string;");
    expect(emitService(ir, post).content).toContain(
      "if (dto.publishedAt !== undefined) entity.publishedAt = dto.publishedAt === null ? null : new Date(dto.publishedAt);",
    );
  });

  it("makes logout public and revokes refresh tokens after a password change", () => {
    const ir = buildIR(blog);

    const controller = emitAuth(ir).find((file) => file.path.endsWith("auth.controller.ts"));
    const service = emitAuth(ir).find((file) => file.path.endsWith("auth.service.ts"));
    if (!controller || !service) throw new Error("Missing auth files");

    const logoutIndex = controller.content.indexOf("@Post('logout')");
    const logoutStart = controller.content.lastIndexOf("@Public()", logoutIndex);
    const nextAuth = controller.content.indexOf("@ApiBearerAuth()", logoutIndex);
    const logout = controller.content.slice(logoutStart, nextAuth);
    expect(logout).toContain("@Public()");
    expect(logout).not.toContain("@ApiBearerAuth()");

    const users = emitUsers(ir).find((file) => file.path.endsWith("users.service.ts"));
    if (!users) throw new Error("Missing users service");
    expect(users.content).toContain("@InjectRepository(RefreshToken)");
    expect(users.content).toContain(".set({ revokedAt: new Date() })");
    expect(users.content).toContain('user.roles LIKE :middle');
  });

  it("emits generated e2e factories that respect length and numeric constraints", () => {
    const project = structuredClone(blog);
    const post = project.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post entity");
    const title = post.fields.find((field) => field.name === "title");
    if (!title) throw new Error("Missing Post title field");
    title.validators = { minLength: 5, maxLength: 40 };
    post.fields.push(createField("score", "int", { validators: { min: 10, max: 20 } }));

    const ir = buildIR(project);
    const spec = emitTests(ir).find((file) =>
      file.path.endsWith("test/utils/factories.ts"),
    );
    if (!spec) throw new Error("Missing test factories");
    expect(spec.content).toContain("sampleString");
    expect(spec.content).toContain("sampleString(`${\"Post\"} ${suffix}`, 5, 40)");
    expect(spec.content).toContain("score: 10,");
  });
});

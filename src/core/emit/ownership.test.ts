import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createEntity, createField, createProject, createRelation } from "../model/defaults";
import { emitController } from "./controller";
import { emitAccessContext } from "./common";
import { emitCreateDto } from "./dto";
import { emitEntity } from "./entity";
import { emitService } from "./service";

function ownedIR() {
  const project = createProject("Owned API");
  const user = project.entities[0];
  if (!user) throw new Error("Missing User entity");

  const post = createEntity("Post");
  post.fields.push(createField("title", "string"));
  post.relations.push(createRelation("owner", user.id, "many-to-one", { nullable: true }));
  post.options.owner = true;
  post.options.ownerRelation = "owner";
  post.access.list = { level: "owner" };
  post.access.read = { level: "owner" };
  post.access.update = { level: "owner" };
  post.access.delete = { level: "owner" };
  project.entities.push(post);

  const ir = buildIR(project);
  const entity = ir.entities.find((candidate) => candidate.name === "Post");
  if (!entity) throw new Error("Missing Post IR");
  return { ir, entity };
}

describe("ownership emission", () => {
  it("generates an indexed owner column with a cascading owner relation", () => {
    const { ir, entity } = ownedIR();
    const content = emitEntity(ir, entity).content;

    expect(entity.ownerColumn).toBe("ownerId");
    expect(content).toContain('@Column({ name: \'owner_id\', type: \'uuid\', nullable: true })');
    expect(content).toContain("ownerId?: string;");
    expect(content).toContain("@ManyToOne('User', { nullable: true, onDelete: 'CASCADE' })");
    expect(content).toContain("@JoinColumn({ name: 'owner_id', referencedColumnName: 'id' })");
  });

  it("never exposes the owner foreign key on the create DTO", () => {
    const { ir, entity } = ownedIR();
    const content = emitCreateDto(ir, entity).content;
    expect(content).not.toContain("ownerId");
    expect(content).not.toContain("owner");
  });

  it("scopes every owner operation and sets the owner on create", () => {
    const { ir, entity } = ownedIR();
    const content = emitService(ir, entity).content;

    expect(content.match(/applyAccessScope\(qb, user, "ownerId", "admin"\)/g)).toHaveLength(4);
    expect(content).toContain("if (user) entity.ownerId = user.id;");
    expect(content).toContain('throw new NotFoundException("Post not found")');
  });

  it("keeps owner routes authenticated and documents the admin bypass", () => {
    const { ir, entity } = ownedIR();
    const content = emitController(ir, entity).content;
    expect(content).toContain("Admin bypass and owner scoping");
    expect(content).not.toContain("@Roles(");
    expect(content).not.toContain("@Public()");
  });

  it("scopes unauthenticated and non-admin callers in the shared helper", () => {
    const { ir } = ownedIR();
    const content = emitAccessContext(ir).content;
    expect(content).toContain("if (!user) return qb.andWhere(\"1 = 0\")");
    expect(content).toContain("if (isAdmin(user, adminRole)) return qb");
    expect(content).toContain("currentUserId: user.id");
  });
});

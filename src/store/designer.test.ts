import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "@/core/model/defaults";
import { projectSchema } from "@/core/model/schema";
import { useProjectStore } from "./project.store";

function reset(): void {
  useProjectStore.setState({
    project: null,
    status: "idle",
    revision: 0,
    lastSavedAt: null,
    error: null,
  });
  useProjectStore.temporal.getState().clear();
  window.localStorage.clear();
  useProjectStore.getState().openProject(createProject("Designer Test"));
}

function project() {
  const current = useProjectStore.getState().project;
  if (!current) throw new Error("No project");
  return current;
}

describe("designer actions", () => {
  beforeEach(reset);

  it("adds entities and fields", () => {
    const entityId = useProjectStore.getState().addEntity("Post");
    const fieldId = useProjectStore.getState().addField(entityId, "title", "string");

    expect(fieldId).not.toBeNull();
    const entity = project().entities.find((candidate) => candidate.id === entityId);
    expect(entity?.name).toBe("Post");
    expect(entity?.fields[0]).toMatchObject({ name: "title", type: "string" });
  });

  it("keeps search and sort fields in sync when renaming a field", () => {
    const entityId = useProjectStore.getState().addEntity("Post");
    useProjectStore.getState().addField(entityId, "title", "string");
    useProjectStore.getState().updateEntityOptions(entityId, {
      searchFields: ["title"],
      sortFields: ["title"],
    });

    const fieldId = project().entities.find((entity) => entity.id === entityId)?.fields[0]?.id;
    if (!fieldId) throw new Error("Missing field");
    useProjectStore.getState().updateField(entityId, fieldId, { name: "headline" });

    const entity = project().entities.find((candidate) => candidate.id === entityId);
    expect(entity?.options.searchFields).toEqual(["headline"]);
    expect(entity?.options.sortFields).toEqual(["headline"]);
  });

  it("keeps a single primary field", () => {
    const entityId = useProjectStore.getState().addEntity("Post");
    const firstId = useProjectStore.getState().addField(entityId, "id", "uuid");
    const secondId = useProjectStore.getState().addField(entityId, "legacyId", "uuid");

    if (!firstId || !secondId) throw new Error("Missing field");

    useProjectStore.getState().updateField(entityId, firstId, { primary: true });
    useProjectStore.getState().updateField(entityId, secondId, { primary: true });

    const entity = project().entities.find((candidate) => candidate.id === entityId);
    expect(entity?.fields.filter((field) => field.primary)).toHaveLength(1);
    expect(entity?.fields.find((field) => field.id === secondId)?.primary).toBe(true);
    expect(entity?.fields.find((field) => field.id === firstId)?.required).toBe(true);
  });

  it("creates and removes the managed owner relation", () => {
    const entityId = useProjectStore.getState().addEntity("Post");

    useProjectStore.getState().setAccess(entityId, "update", { level: "owner" });
    let entity = project().entities.find((candidate) => candidate.id === entityId);
    expect(entity?.options.owner).toBe(true);
    expect(entity?.options.ownerRelation).toBe("owner");
    expect(entity?.relations).toEqual([
      expect.objectContaining({ name: "owner", kind: "many-to-one", targetEntityId: "ent_user" }),
    ]);

    useProjectStore.getState().setAccess(entityId, "update", { level: "authenticated" });
    entity = project().entities.find((candidate) => candidate.id === entityId);
    expect(entity?.options.owner).toBe(false);
    expect(entity?.options.ownerRelation).toBeUndefined();
    expect(entity?.relations).toEqual([]);
  });

  it("removes inbound relations when deleting an entity", () => {
    const postId = useProjectStore.getState().addEntity("Post");
    const tagId = useProjectStore.getState().addEntity("Tag");

    useProjectStore.getState().addRelation(postId, {
      name: "tag",
      targetEntityId: tagId,
      kind: "many-to-one",
      nullable: true,
      cascade: false,
    });

    expect(useProjectStore.getState().deleteEntity(tagId)).toBe(true);
    const post = project().entities.find((candidate) => candidate.id === postId);
    expect(post?.relations.some((relation) => relation.targetEntityId === tagId)).toBe(false);
    expect(post?.relations).toEqual([
      expect.objectContaining({ name: "owner", targetEntityId: "ent_user" }),
    ]);
  });

  it("protects the built-in User entity", () => {
    expect(useProjectStore.getState().deleteEntity("ent_user")).toBe(false);
    expect(useProjectStore.getState().duplicateEntity("ent_user")).toBeNull();
  });

  it("duplicates an entity with fresh ids", () => {
    const postId = useProjectStore.getState().addEntity("Post");
    useProjectStore.getState().addField(postId, "title", "string");

    const cloneId = useProjectStore.getState().duplicateEntity(postId);
    expect(cloneId).not.toBeNull();

    const source = project().entities.find((entity) => entity.id === postId);
    const clone = project().entities.find((entity) => entity.id === cloneId);
    expect(clone?.name).toBe("PostCopy");
    expect(clone?.fields[0]?.id).not.toBe(source?.fields[0]?.id);
  });

  it("rejects stored one-to-many relations", () => {
    const postId = useProjectStore.getState().addEntity("Post");
    expect(
      useProjectStore.getState().addRelation(postId, {
        name: "comments",
        targetEntityId: "ent_user",
        kind: "one-to-many",
        nullable: false,
        cascade: false,
      }),
    ).toBeNull();
  });

  it("propagates role renames and blocks removing roles in use", () => {
    const entityId = useProjectStore.getState().addEntity("Post");
    useProjectStore.getState().setAccess(entityId, "list", { level: "roles", roles: ["user"] });

    expect(useProjectStore.getState().renameRole("user", "member")).toBe(true);
    expect(project().auth.roles.map((role) => role.key)).toContain("member");

    const entity = project().entities.find((candidate) => candidate.id === entityId);
    expect(entity?.access.list.roles).toEqual(["member"]);

    expect(useProjectStore.getState().removeRole("member")).toBe(false);
    expect(useProjectStore.getState().renameRole("admin", "root")).toBe(false);
    expect(useProjectStore.getState().removeRole("admin")).toBe(false);
  });

  it("refuses to delete an enum still used by a field", () => {
    const enumId = useProjectStore.getState().addEnum("PostStatus", ["draft"]);
    const entityId = useProjectStore.getState().addEntity("Post");
    const fieldId = useProjectStore.getState().addField(entityId, "status", "enum");
    if (!fieldId) throw new Error("Missing field");

    useProjectStore.getState().updateField(entityId, fieldId, { enumId });
    expect(useProjectStore.getState().deleteEnum(enumId)).toBe(false);

    useProjectStore.getState().updateField(entityId, fieldId, { enumId: undefined });
    expect(useProjectStore.getState().deleteEnum(enumId)).toBe(true);
  });

  it("blocks deleting the managed owner relation", () => {
    const entityId = useProjectStore.getState().addEntity("Post");
    useProjectStore.getState().setAccess(entityId, "update", { level: "owner" });

    const entity = project().entities.find((candidate) => candidate.id === entityId);
    const ownerRelation = entity?.relations[0];
    if (!ownerRelation) throw new Error("Missing owner relation");

    expect(useProjectStore.getState().deleteRelation(entityId, ownerRelation.id)).toBe(false);
  });

  it("round-trips auth settings and access rules through save", async () => {
    const entityId = useProjectStore.getState().addEntity("Post");
    useProjectStore.getState().setAccess(entityId, "update", { level: "owner" });
    useProjectStore.getState().updateAuth((draft) => {
      draft.accessTokenTtl = "30m";
      draft.registerEnabled = false;
    });
    expect(useProjectStore.getState().renameRole("user", "member")).toBe(true);
    expect(useProjectStore.getState().addRole("editor", "Editor")).toBe(true);

    const current = project();
    expect(await useProjectStore.getState().saveNow()).toBe(true);

    const raw = window.localStorage.getItem("chz-nest:projects");
    if (!raw) throw new Error("Missing stored projects");
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const parsed = projectSchema.parse(stored[current.id]);
    const entity = parsed.entities.find((candidate) => candidate.id === entityId);

    expect(parsed.auth.accessTokenTtl).toBe("30m");
    expect(parsed.auth.registerEnabled).toBe(false);
    expect(parsed.auth.roles.map((role) => role.key)).toContain("member");
    expect(parsed.auth.roles.map((role) => role.key)).toContain("editor");
    expect(entity?.options.owner).toBe(true);
    expect(entity?.access.update).toEqual({ level: "owner" });
  });
});

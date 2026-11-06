// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createEntity, createField, createProject } from "../model/defaults";
import type { Driver, FieldDef, Project } from "../model/schema";
import { emitPagination } from "./common";
import { emitQueryDto } from "./dto";
import { emitService } from "./service";

function addFields(entity: ReturnType<typeof createEntity>, fields: FieldDef[]): void {
  entity.fields.push(...fields);
}

function searchProject(searchFields: string[] = [], driver: Driver = "postgres"): Project {
  const project = createProject("Search API", driver);
  const entity = createEntity("Post");
  addFields(entity, [
    createField("title", "string"),
    createField("body", "text"),
    createField("views", "int"),
    createField("price", "decimal", { column: { precision: 10, scale: 2 } }),
  ]);
  entity.options.searchFields = [...searchFields];
  entity.access.update = { level: "authenticated" };
  project.entities.push(entity);
  return project;
}

function metricProject(): Project {
  const project = createProject("Metrics API");
  const entity = createEntity("Metric");
  addFields(entity, [createField("count", "int")]);
  entity.access.update = { level: "authenticated" };
  project.entities.push(entity);
  return project;
}

function serviceFor(project: Project, entityName: string): string {
  const ir = buildIR(project);
  const entity = ir.entities.find((candidate) => candidate.name === entityName);
  if (!entity) throw new Error(`Missing ${entityName} entity`);
  return emitService(ir, entity).content;
}

describe("generated list querying", () => {
  it("falls back to all string and text fields when no search fields are selected", () => {
    const content = serviceFor(searchProject(), "Post");

    expect(content).toContain("post.title ILIKE :search OR post.body ILIKE :search");
    expect(content).not.toContain("post.views ILIKE :search");
    expect(content).not.toContain("post.price ILIKE :search");
    expect(content).toContain("if (query.search) {");
  });

  it("uses only the selected search fields when configured", () => {
    const content = serviceFor(searchProject(["title"]), "Post");

    expect(content).toContain("post.title ILIKE :search");
    expect(content).not.toContain("post.body ILIKE :search");
  });

  it("deduplicates repeated search fields", () => {
    const content = serviceFor(searchProject(["title", "title"]), "Post");
    const occurrences = content.match(/post\.title ILIKE :search/g) ?? [];

    expect(occurrences).toHaveLength(1);
  });

  it("does not emit a search clause for entities without string or text fields", () => {
    const content = serviceFor(metricProject(), "Metric");

    expect(content).not.toContain("query.search");
  });

  it("emits case-insensitive contains filters for string and text fields", () => {
    const content = serviceFor(searchProject(), "Post");

    expect(content).toContain(
      'qb.andWhere("post.title ILIKE :title", { title: `%${query.title}%` });',
    );
    expect(content).toContain(
      'qb.andWhere("post.body ILIKE :body", { body: `%${query.body}%` });',
    );
  });

  it("keeps equality filters for non-text fields", () => {
    const content = serviceFor(searchProject(), "Post");

    expect(content).toContain(
      'qb.andWhere("post.views = :views", { views: query.views });',
    );
    expect(content).toContain(
      'qb.andWhere("post.price = :price", { price: query.price });',
    );
  });

  it("uses LIKE instead of ILIKE for SQLite", () => {
    const content = serviceFor(searchProject([], "sqlite"), "Post");

    expect(content).toContain("post.title LIKE :search OR post.body LIKE :search");
    expect(content).toContain(
      'qb.andWhere("post.title LIKE :title", { title: `%${query.title}%` });',
    );
  });
});

describe("generated query DTOs and pagination", () => {
  it("emits typed filters, numeric ranges and date ranges", () => {
    const project = searchProject();
    const post = project.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post");
    post.fields.push(createField("publishedAt", "datetime", { required: false }));

    const ir = buildIR(project);
    const entity = ir.entities.find((candidate) => candidate.name === "Post");
    if (!entity) throw new Error("Missing Post IR");
    const content = emitQueryDto(ir, entity).content;

    expect(content).toContain("title?: string;");
    expect(content).toContain("views?: number;");
    expect(content).toContain("viewsGte?: number;");
    expect(content).toContain("viewsLte?: number;");
    expect(content).toContain("priceGte?: number;");
    expect(content).toContain("publishedAtGte?: string;");
    expect(content).toContain("publishedAtLte?: string;");
    expect(content).toContain("@IsDateString()");
    expect(content).toContain("@Type(() => Number)");
  });

  it("emits boolean filters with a safe string transform", () => {
    const project = searchProject();
    const post = project.entities.find((entity) => entity.name === "Post");
    if (!post) throw new Error("Missing Post");
    post.fields.push(createField("featured", "boolean", { required: false }));

    const ir = buildIR(project);
    const entity = ir.entities.find((candidate) => candidate.name === "Post");
    if (!entity) throw new Error("Missing Post IR");
    const content = emitQueryDto(ir, entity).content;

    expect(content).toContain('value === true || value === "true"');
    expect(content).toContain("@IsBoolean()");
    expect(content).toContain("featured?: boolean;");
  });

  it("rejects unknown sort fields instead of silently ignoring them", () => {
    const content = serviceFor(searchProject(), "Post");

    expect(content).toContain("qb.select([");
    expect(content).toContain('"post.title"');
    expect(content).not.toContain('"post.passwordHash"');
    expect(content).toContain("Invalid sort field");
    expect(content).toContain("throw new BadRequestException");
    expect(content).toContain('query.sort?.replace(/^[-+]/, "")');
  });

  it("returns the paginated meta envelope", () => {
    const content = serviceFor(searchProject(), "Post");

    expect(content).toContain(
      "return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };",
    );
  });

  it("adds withDeleted to the shared pagination DTO", () => {
    const project = createProject("Search API");
    const content = emitPagination(buildIR(project))
      .map((generated) => generated.content)
      .join("\n");

    expect(content).toContain("withDeleted?: boolean;");
    expect(content).toContain("totalPages: number;");
    expect(content).toContain("meta: PaginationMeta;");
  });
});

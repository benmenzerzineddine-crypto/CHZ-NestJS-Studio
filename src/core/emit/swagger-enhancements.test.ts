import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createEntity, createProject } from "../model/defaults";
import { emitController } from "./controller";
import { emitCreateDto } from "./dto";
import { emitSwaggerConfig } from "./config";

describe("Swagger / OpenAPI enhancements", () => {
  it("emits @ApiParam for primary key :id and custom endpoint path params", () => {
    const project = createProject("Blog API", "postgres", true);
    const postEntity = createEntity("Post");
    postEntity.customEndpoints.push({
      id: "ep_by_slug" as any,
      name: "getBySlug",
      method: "GET",
      path: "by-slug/:slug",
      description: "Find post by unique slug",
      access: { level: "public" },
    });
    project.entities.push(postEntity);

    const ir = buildIR(project);
    const entityIR = ir.entities.find((e) => e.name === "Post")!;
    const controller = emitController(ir, entityIR);

    expect(controller.content).toContain("@ApiParam({ name: 'id', type: String, description: 'Unique Post identifier' })");
    expect(controller.content).toContain("@ApiParam({ name: 'slug', required: true, description: 'slug path parameter' })");
    expect(controller.content).toContain("ApiParam");
  });

  it("emits integer type for int primary key in @ApiParam", () => {
    const project = createProject("Int API", "postgres", false);
    const item = createEntity("Item");
    item.fields.push({
      id: "fld_id" as any,
      name: "id",
      type: "int",
      required: true,
      unique: true,
      indexed: true,
      primary: true,
    });
    project.entities.push(item);

    const ir = buildIR(project);
    const entityIR = ir.entities.find((e) => e.name === "Item")!;
    const controller = emitController(ir, entityIR);

    expect(controller.content).toContain("@ApiParam({ name: 'id', type: Number, description: 'Unique Item identifier' })");
  });

  it("includes validator constraints (min, max, pattern, default) in @ApiProperty", () => {
    const project = createProject("Validation DTO API", "postgres", false);
    const product = createEntity("Product");
    product.fields.push(
      {
        id: "fld_price" as any,
        name: "price",
        type: "float",
        required: true,
        unique: false,
        indexed: false,
        primary: false,
        defaultValue: "9.99",
        validators: { min: 0.99, max: 999.99 },
      },
      {
        id: "fld_sku" as any,
        name: "sku",
        type: "string",
        required: true,
        unique: true,
        indexed: true,
        primary: false,
        validators: { minLength: 3, maxLength: 20, pattern: "^[A-Z0-9-]+$" },
      },
    );
    project.entities.push(product);

    const ir = buildIR(project);
    const entityIR = ir.entities.find((e) => e.name === "Product")!;
    const createDto = emitCreateDto(ir, entityIR);

    expect(createDto.content).toContain("minimum: 0.99");
    expect(createDto.content).toContain("maximum: 999.99");
    expect(createDto.content).toContain('default: "9.99"');
    expect(createDto.content).toContain("minLength: 3");
    expect(createDto.content).toContain("maxLength: 20");
    expect(createDto.content).toContain('pattern: "^[A-Z0-9-]+$"');
  });

  it("emits tags and persistAuthorization in setupSwagger", () => {
    const project = createProject("Swagger API", "postgres", true);
    project.entities.push(createEntity("Article"));

    const ir = buildIR(project);
    const swaggerFile = emitSwaggerConfig(ir);

    expect(swaggerFile.content).toContain(".addTag('auth', 'Authentication and account management')");
    expect(swaggerFile.content).toContain(".addTag('articles', 'Operations for Article')");
    expect(swaggerFile.content).toContain("persistAuthorization: true");
  });
});

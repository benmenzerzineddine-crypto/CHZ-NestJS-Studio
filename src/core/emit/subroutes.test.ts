import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createEntity, createProject } from "../model/defaults";
import { emitController } from "./controller";
import { emitService } from "./service";
import { buildEntityRouteGroups } from "../../features/endpoints/route-builder";

describe("One-to-many sub-routes", () => {
  function setupCategoryProductProject(childPaginated = true) {
    const project = createProject("Store API", "postgres", false);
    const category = createEntity("Category");
    const product = createEntity("Product");
    product.options.pagination = childPaginated;

    product.relations.push({
      id: "rel_product_category" as any,
      name: "category",
      targetEntityId: category.id,
      kind: "many-to-one",
      nullable: false,
      cascade: false,
    });

    project.entities.push(category, product);
    return { project, category, product };
  }

  it("emits GET and POST subroutes in CategoryController", () => {
    const { project } = setupCategoryProductProject(true);
    const ir = buildIR(project);
    const categoryIR = ir.entities.find((e) => e.name === "Category")!;
    const controller = emitController(ir, categoryIR);

    expect(controller.content).toContain("@Get(':id/products')");
    expect(controller.content).toContain("findProducts(");
    expect(controller.content).toContain("@Post(':id/products')");
    expect(controller.content).toContain("createProduct(");
    expect(controller.content).toContain("CreateProductDto");
    expect(controller.content).toContain("QueryProductDto");
    expect(controller.content).toContain("PaginatedProductDto");
    expect(controller.content).toContain("Product as ProductEntity");
  });

  it("emits findProducts and createProduct in CategoryService using DataSource", () => {
    const { project } = setupCategoryProductProject(false);
    const ir = buildIR(project);
    const categoryIR = ir.entities.find((e) => e.name === "Category")!;
    const service = emitService(ir, categoryIR);

    expect(service.content).toContain("private readonly dataSource: DataSource");
    expect(service.content).toContain("async findProducts(");
    expect(service.content).toContain('this.dataSource.getRepository(Product).createQueryBuilder("product")');
    expect(service.content).toContain('qb.where("product.categoryId = :parentId", { parentId: id })');
    expect(service.content).toContain("async createProduct(");
    expect(service.content).toContain("this.dataSource.getRepository(Product)");
    expect(service.content).toContain("entity.categoryId = id");
  });

  it("registers subroutes in route-builder for UI display", () => {
    const { project } = setupCategoryProductProject(true);
    const groups = buildEntityRouteGroups(project, "");
    const categoryGroup = groups.find((g) => g.name === "Category")!;

    const getProducts = categoryGroup.routes.find(
      (r) => r.path === "/api/categories/:id/products" && r.method === "GET",
    );
    const postProducts = categoryGroup.routes.find(
      (r) => r.path === "/api/categories/:id/products" && r.method === "POST",
    );

    expect(getProducts).toBeDefined();
    expect(getProducts?.note).toBe("List products for Category");
    expect(postProducts).toBeDefined();
    expect(postProducts?.note).toBe("Create Product for Category");
  });
});

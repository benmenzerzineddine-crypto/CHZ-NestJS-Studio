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

describe("Many-to-many sub-routes", () => {
  function setupPostTagProject() {
    const project = createProject("Blog API", "postgres", false);
    const post = createEntity("Post");
    const tag = createEntity("Tag");

    post.relations.push({
      id: "rel_post_tags" as any,
      name: "tags",
      targetEntityId: tag.id,
      kind: "many-to-many",
      nullable: false,
      cascade: false,
    });

    project.entities.push(post, tag);
    return { project, post, tag };
  }

  it("emits GET, POST, and DELETE subroutes in PostController", () => {
    const { project } = setupPostTagProject();
    const ir = buildIR(project);
    const postIR = ir.entities.find((e) => e.name === "Post")!;
    const controller = emitController(ir, postIR);

    expect(controller.content).toContain("@Get(':id/tags')");
    expect(controller.content).toContain("findTags(");
    expect(controller.content).toContain("@Post(':id/tags')");
    expect(controller.content).toContain("attachTags(");
    expect(controller.content).toContain("@Delete(':id/tags/:tagId')");
    expect(controller.content).toContain("detachTag(");
    expect(controller.content).toContain("AttachTagsDto");
    expect(controller.content).toContain("Tag as TagEntity");
    expect(controller.content).toContain("@ApiParam({ name: 'tagId'");
  });

  it("emits findTags, attachTags, and detachTag in PostService using RelationQueryBuilder", () => {
    const { project } = setupPostTagProject();
    const ir = buildIR(project);
    const postIR = ir.entities.find((e) => e.name === "Post")!;
    const service = emitService(ir, postIR);

    expect(service.content).toContain("async findTags(");
    expect(service.content).toContain('.relation("tags").of(id).loadMany()');
    expect(service.content).toContain("async attachTags(");
    expect(service.content).toContain('.relation("tags").of(id).add(ids)');
    expect(service.content).toContain("async detachTag(");
    expect(service.content).toContain('.relation("tags").of(id).remove(tagId)');
  });

  it("registers GET, POST, and DELETE many-to-many routes in route-builder", () => {
    const { project } = setupPostTagProject();
    const groups = buildEntityRouteGroups(project, "");
    const postGroup = groups.find((g) => g.name === "Post")!;

    const getTags = postGroup.routes.find(
      (r) => r.path === "/api/posts/:id/tags" && r.method === "GET",
    );
    const postTags = postGroup.routes.find(
      (r) => r.path === "/api/posts/:id/tags" && r.method === "POST",
    );
    const deleteTag = postGroup.routes.find(
      (r) => r.path === "/api/posts/:id/tags/:tagId" && r.method === "DELETE",
    );

    expect(getTags).toBeDefined();
    expect(getTags?.note).toBe("List tags for Post");
    expect(postTags).toBeDefined();
    expect(postTags?.note).toBe("Attach tags to Post");
    expect(deleteTag).toBeDefined();
    expect(deleteTag?.note).toBe("Detach Tag from Post");
  });
});


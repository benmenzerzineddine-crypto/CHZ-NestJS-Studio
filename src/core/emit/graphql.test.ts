import { describe, expect, it } from "vitest";
import blogJson from "../fixtures/blog.json";
import { generateProject } from "../generate";
import { buildIR } from "../ir/build";
import { projectSchema, type Project } from "../model/schema";
import { emitAppModule } from "./config";
import { emitEntity } from "./entity";
import { emitCreateInput, emitResolver, emitUpdateInput } from "./graphql";

function getBlogProject(): Project {
  return projectSchema.parse(structuredClone(blogJson));
}

describe("GraphQL Schema & Resolver Emission", () => {
  it("does not emit GraphQL artifacts or dependencies when disabled", async () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: false,
      playground: true,
      path: "/graphql",
    };

    const ir = buildIR(project);
    const result = await generateProject(project);
    const files = result.files;

    const resolverFiles = files.filter((f) => f.path.endsWith(".resolver.ts"));
    const inputFiles = files.filter((f) => f.path.endsWith(".input.ts"));
    expect(resolverFiles).toHaveLength(0);
    expect(inputFiles).toHaveLength(0);

    const appModule = emitAppModule(ir).content;
    expect(appModule).not.toContain("GraphQLModule");
    expect(appModule).not.toContain("ApolloDriver");

    const packageJsonFile = files.find((f) => f.path === "package.json")!;
    const packageJson = JSON.parse(packageJsonFile.content);
    expect(packageJson.dependencies["@nestjs/graphql"]).toBeUndefined();
    expect(packageJson.dependencies["@nestjs/apollo"]).toBeUndefined();
    expect(packageJson.dependencies["@apollo/server"]).toBeUndefined();
    expect(packageJson.dependencies["graphql"]).toBeUndefined();

    const postEntity = ir.entities.find((e) => e.name === "Post");
    expect(postEntity).toBeDefined();
    const entityContent = emitEntity(ir, postEntity!).content;
    expect(entityContent).not.toContain("@ObjectType()");
    expect(entityContent).not.toContain("@Field()");
  });

  it("emits inputs and resolvers when graphql is enabled", () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: true,
      playground: true,
      path: "/graphql",
    };

    const ir = buildIR(project);
    const postEntity = ir.entities.find((e) => e.name === "Post")!;

    // Create input
    const createInput = emitCreateInput(ir, postEntity);
    expect(createInput.path).toBe("src/modules/post/dto/create-post.input.ts");
    expect(createInput.content).toContain("@InputType()");
    expect(createInput.content).toContain("export class CreatePostInput");
    expect(createInput.content).toContain("@Field(() => String)");
    expect(createInput.content).toContain("title: string;");

    // Update input
    const updateInput = emitUpdateInput(ir, postEntity);
    expect(updateInput.path).toBe("src/modules/post/dto/update-post.input.ts");
    expect(updateInput.content).toContain("@InputType()");
    expect(updateInput.content).toContain("export class UpdatePostInput extends PartialType(CreatePostInput)");

    // Resolver
    const resolver = emitResolver(ir, postEntity);
    expect(resolver.path).toBe("src/modules/post/post.resolver.ts");
    expect(resolver.content).toContain("@Resolver(() => Post)");
    expect(resolver.content).toContain("export class PostResolver");
    expect(resolver.content).toContain('@Query(() => [Post], { name: "posts" })');
    expect(resolver.content).toContain('@Query(() => Post, { name: "post", nullable: true })');
    expect(resolver.content).toContain('@Mutation(() => Post, { name: "createPost" })');
    expect(resolver.content).toContain('@Mutation(() => Post, { name: "updatePost" })');
    expect(resolver.content).toContain('@Mutation(() => Boolean, { name: "removePost" })');
    expect(resolver.content).toContain("async posts(");
    expect(resolver.content).toContain("async post(");
    expect(resolver.content).toContain("async createPost(");
    expect(resolver.content).toContain("async updatePost(");
    expect(resolver.content).toContain("async removePost(");
  });

  it("emits soft delete restore mutation when entity has soft delete", () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: true,
      playground: true,
      path: "/graphql",
    };
    const entity = project.entities.find((e) => e.name === "Post")!;
    entity.options.softDelete = true;

    const ir = buildIR(project);
    const postEntity = ir.entities.find((e) => e.name === "Post")!;
    const resolver = emitResolver(ir, postEntity);

    expect(resolver.content).toContain('@Mutation(() => Boolean, { name: "restorePost" })');
    expect(resolver.content).toContain("async restorePost(");
  });

  it("emits access control decorators (@Public, @Roles) on resolver methods", () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: true,
      playground: true,
      path: "/graphql",
    };
    const post = project.entities.find((e) => e.name === "Post")!;
    post.access = {
      list: { level: "public" },
      read: { level: "public" },
      create: { level: "roles", roles: ["admin", "editor"] },
      update: { level: "roles", roles: ["admin"] },
      delete: { level: "roles", roles: ["admin"] },
    };

    const ir = buildIR(project);
    const postEntity = ir.entities.find((e) => e.name === "Post")!;
    const resolver = emitResolver(ir, postEntity);

    expect(resolver.content).toContain("@Public()");
    expect(resolver.content).toContain('@Roles("admin", "editor")');
    expect(resolver.content).toContain('@Roles("admin")');
  });

  it("decorates entities with @ObjectType() and @Field() when graphql is enabled", () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: true,
      playground: true,
      path: "/graphql",
    };

    const ir = buildIR(project);
    const postEntity = ir.entities.find((e) => e.name === "Post")!;
    const entityCode = emitEntity(ir, postEntity).content;

    expect(entityCode).toContain("@ObjectType()");
    expect(entityCode).toContain("@Field(() => ID)");
    expect(entityCode).toContain("@Field(() => String)");
    expect(entityCode).toContain("@Field(() => Date)");
  });

  it("hides sensitive auth columns from GraphQL @Field()", () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: true,
      playground: true,
      path: "/graphql",
    };
    project.auth.twoFactor = true;

    const ir = buildIR(project);
    const userEntity = ir.entities.find((e) => e.name === "User")!;
    const entityCode = emitEntity(ir, userEntity).content;

    expect(entityCode).toContain("@ObjectType()");
    expect(entityCode).toContain("passwordHash: string;");
    expect(entityCode).not.toContain("@Field()\n  passwordHash");
    expect(entityCode).not.toContain("@Field(() => String)\n  passwordHash");
    expect(entityCode).not.toContain("@Field(() => String, { nullable: true })\n  twoFactorSecret");
    expect(entityCode).not.toContain("@Field(() => [String], { nullable: true })\n  twoFactorRecoveryCodes");
  });

  it("integrates GraphQLModule in AppModule and registers resolver in entity module", async () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: true,
      playground: false,
      path: "/api/graphql",
    };

    const result = await generateProject(project);
    const files = result.files;

    // App module
    const appModule = files.find((f) => f.path === "src/app.module.ts")!.content;
    expect(appModule).toContain("GraphQLModule.forRoot<ApolloDriverConfig>({");
    expect(appModule).toContain("driver: ApolloDriver");
    expect(appModule).toContain('path: "/api/graphql"');
    expect(appModule).toContain("playground: false");
    expect(appModule).toContain('autoSchemaFile: join(process.cwd(), "src/schema.gql")');

    // Entity module
    const postModule = files.find((f) => f.path === "src/modules/post/post.module.ts")!.content;
    expect(postModule).toContain("PostResolver");
    expect(postModule).toContain("providers: [PostService, PostResolver]");

    // Package.json dependencies
    const packageJson = JSON.parse(files.find((f) => f.path === "package.json")!.content);
    expect(packageJson.dependencies["@nestjs/graphql"]).toBe("^13.0.3");
    expect(packageJson.dependencies["@nestjs/apollo"]).toBe("^13.0.3");
    expect(packageJson.dependencies["@apollo/server"]).toBe("^4.11.3");
    expect(packageJson.dependencies["graphql"]).toBe("^16.10.0");
  });

  it("handles multitenancy in resolvers and inputs", () => {
    const project = getBlogProject();
    project.settings.graphql = {
      enabled: true,
      playground: true,
      path: "/graphql",
    };
    project.settings.multitenancy = {
      enabled: true,
      header: "x-tenant-id",
    };
    const post = project.entities.find((e) => e.name === "Post")!;
    post.options.multitenant = true;

    const ir = buildIR(project);
    const postEntity = ir.entities.find((e) => e.name === "Post")!;
    const resolver = emitResolver(ir, postEntity);

    expect(resolver.content).toContain("@CurrentTenant() tenantId: string");
    expect(resolver.content).toContain("this.postService.findAll(undefined, tenantId");
  });
});

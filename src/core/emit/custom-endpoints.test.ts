import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createCustomEndpoint, createEntity, createProject } from "../model/defaults";
import { emitController } from "./controller";
import { emitService } from "./service";

describe("custom endpoints emission", () => {
  it("emits custom routes with decorators in controller", () => {
    const project = createProject("Test API", "postgres", true);
    const post = createEntity("Post");
    post.customEndpoints.push(
      createCustomEndpoint("publish", "POST", "/publish", { level: "authenticated" }, {
        description: "Publish post",
      }),
      createCustomEndpoint("archive", "PUT", ":id/archive", {
        level: "roles",
        roles: ["admin"],
      }),
      createCustomEndpoint("stats", "GET", "/stats", { level: "public" }),
      createCustomEndpoint("purge", "DELETE", ":id/purge", { level: "authenticated" }),
    );
    project.entities.push(post);

    const ir = buildIR(project);
    const entity = ir.entities.find((e) => e.name === "Post")!;
    const controller = emitController(ir, entity).content;

    // Check imports
    expect(controller).toContain("Put");
    expect(controller).toContain("Public");
    expect(controller).toContain("Roles");

    // Check POST /publish
    expect(controller).toContain("@ApiOperation({ summary: \"Publish post\" })");
    expect(controller).toContain("@ApiBearerAuth()");
    expect(controller).toContain("@Post('publish')");
    expect(controller).toContain("publish(@CurrentUser() user?: AuthUser) {");
    expect(controller).toContain("return this.service.publish(user);");

    // Check PUT :id/archive with roles
    expect(controller).toContain('@Roles("admin")');
    expect(controller).toContain("@Put(':id/archive')");
    expect(controller).toContain("archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: AuthUser) {");
    expect(controller).toContain("return this.service.archive(id, user);");

    // Check GET /stats with public
    expect(controller).toContain("@Public()");
    expect(controller).toContain("@Get('stats')");
    expect(controller).toContain("stats(@CurrentUser() user?: AuthUser) {");
    expect(controller).toContain("return this.service.stats(user);");

    // Check DELETE :id/purge
    expect(controller).toContain("@Delete(':id/purge')");
    expect(controller).toContain("purge(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: AuthUser) {");
  });

  it("emits service stubs for custom endpoints", () => {
    const project = createProject("Test API", "postgres", true);
    const post = createEntity("Post");
    post.customEndpoints.push(
      createCustomEndpoint("publish", "POST", "/publish"),
      createCustomEndpoint("archive", "PUT", ":id/archive"),
    );
    project.entities.push(post);

    const ir = buildIR(project);
    const entity = ir.entities.find((e) => e.name === "Post")!;
    const service = emitService(ir, entity).content;

    expect(service).toContain("async publish(user?: AuthUser): Promise<{ message: string }> {");
    expect(service).toContain("// TODO: Implement custom endpoint logic for publish");
    expect(service).toContain('return { message: "publish stub" };');

    expect(service).toContain("async archive(id: string, user?: AuthUser): Promise<{ message: string }> {");
    expect(service).toContain("// TODO: Implement custom endpoint logic for archive");
    expect(service).toContain('return { message: "archive stub" };');
  });

  it("does not import Put or emit extra methods when customEndpoints is empty", () => {
    const project = createProject("Test API", "postgres", true);
    const post = createEntity("Post");
    project.entities.push(post);

    const ir = buildIR(project);
    const entity = ir.entities.find((e) => e.name === "Post")!;
    const controller = emitController(ir, entity).content;
    const service = emitService(ir, entity).content;

    expect(controller).not.toContain("Put");
    expect(service).not.toContain("// TODO: Implement custom endpoint logic");
  });
});

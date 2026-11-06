import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createCustomEndpoint, createEntity, createProject } from "../model/defaults";
import { emitAppModule } from "./config";
import { emitController } from "./controller";

describe("throttling and cache hints emission", () => {
  it("emits default ThrottlerModule and ThrottlerGuard in AppModule", () => {
    const project = createProject("Test API");
    const ir = buildIR(project);
    const appModule = emitAppModule(ir);

    expect(appModule.content).toContain('import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";');
    expect(appModule.content).toContain("ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])");
    expect(appModule.content).toContain("{ provide: APP_GUARD, useClass: ThrottlerGuard }");
  });

  it("omits ThrottlerModule and ThrottlerGuard when throttling is disabled", () => {
    const project = createProject("Test API", "postgres", false);
    project.settings.throttling.enabled = false;
    const ir = buildIR(project);
    const appModule = emitAppModule(ir);

    expect(appModule.content).not.toContain("@nestjs/throttler");
    expect(appModule.content).not.toContain("ThrottlerModule");
    expect(appModule.content).not.toContain("ThrottlerGuard");
    expect(appModule.content).not.toContain("APP_GUARD");
  });

  it("emits custom throttling window and limit in AppModule", () => {
    const project = createProject("Test API");
    project.settings.throttling.ttl = 120;
    project.settings.throttling.limit = 500;
    const ir = buildIR(project);
    const appModule = emitAppModule(ir);

    expect(appModule.content).toContain("ThrottlerModule.forRoot([{ ttl: 120000, limit: 500 }])");
  });

  it("emits @Throttle on entity controller when entity has throttle option", () => {
    const project = createProject("Test API");
    const entity = createEntity("Article");
    entity.options.throttle = { limit: 20, ttl: 60 };
    project.entities.push(entity);

    const ir = buildIR(project);
    const entityIr = ir.entities.find((e) => e.name === "Article")!;
    const controller = emitController(ir, entityIr);

    expect(controller.content).toContain('import { Throttle } from "@nestjs/throttler";');
    expect(controller.content).toContain("@Throttle({ default: { limit: 20, ttl: 60000 } })");
  });

  it("emits @Header('Cache-Control') on findAll and findOne when entity has cache option", () => {
    const project = createProject("Test API");
    const entity = createEntity("Article");
    entity.options.cache = { maxAge: 300, scope: "public", sharedMaxAge: 600 };
    project.entities.push(entity);

    const ir = buildIR(project);
    const entityIr = ir.entities.find((e) => e.name === "Article")!;
    const controller = emitController(ir, entityIr);

    expect(controller.content).toContain("Header");
    expect(controller.content).toContain("@Header('Cache-Control', 'public, max-age=300, s-maxage=600')");
    // Ensure it appears on both read endpoints
    const matches = controller.content.match(/@Header\('Cache-Control', 'public, max-age=300, s-maxage=600'\)/g);
    expect(matches).toHaveLength(2);
  });

  it("emits @Throttle, @SkipThrottle, and @Header on custom endpoints", () => {
    const project = createProject("Test API");
    const entity = createEntity("Article");

    const ep1 = createCustomEndpoint("feed", "GET", "/feed");
    ep1.throttle = { limit: 5, ttl: 10 };
    ep1.cache = { maxAge: 60, scope: "public" };

    const ep2 = createCustomEndpoint("ping", "GET", "/ping");
    ep2.skipThrottle = true;

    entity.customEndpoints.push(ep1, ep2);
    project.entities.push(entity);

    const ir = buildIR(project);
    const entityIr = ir.entities.find((e) => e.name === "Article")!;
    const controller = emitController(ir, entityIr);

    expect(controller.content).toContain('import { SkipThrottle, Throttle } from "@nestjs/throttler";');
    expect(controller.content).toContain("@Throttle({ default: { limit: 5, ttl: 10000 } })");
    expect(controller.content).toContain("@Header('Cache-Control', 'public, max-age=60')");
    expect(controller.content).toContain("@SkipThrottle()");
  });
});

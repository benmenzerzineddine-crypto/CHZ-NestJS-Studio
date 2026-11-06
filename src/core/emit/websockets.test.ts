import { describe, expect, it } from "vitest";
import { generateProject } from "../generate";
import { createEntity, createField, createProject } from "../model/defaults";
import { buildIR } from "../ir/build";
import { emitWebSockets } from "./websockets";
import { emitService } from "./service";

describe("emitWebSockets", () => {
  it("returns empty array when websockets are disabled", () => {
    const project = createProject("No WS API");
    project.settings.websockets.enabled = false;
    const ir = buildIR(project);
    expect(emitWebSockets(ir)).toEqual([]);
  });

  it("emits EventsGateway and EventsModule when enabled", () => {
    const project = createProject("WS API");
    project.settings.websockets.enabled = true;
    project.settings.websockets.path = "/realtime";
    project.settings.websockets.corsOrigin = "https://example.com";
    project.settings.websockets.auth = true;

    const ir = buildIR(project);
    const files = emitWebSockets(ir);

    expect(files.length).toBe(2);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("src/events/events.gateway.ts");
    expect(paths).toContain("src/events/events.module.ts");

    const gateway = files.find((f) => f.path === "src/events/events.gateway.ts")!;
    expect(gateway.content).toContain("@WebSocketGateway");
    expect(gateway.content).toContain("cors: { origin: \"https://example.com\" }");
    expect(gateway.content).toContain("path: \"/realtime\"");
    expect(gateway.content).toContain("jwtService.verifyAsync");
    expect(gateway.content).toContain("emitEntityEvent");
    expect(gateway.content).toContain("emitToUser");

    const module = files.find((f) => f.path === "src/events/events.module.ts")!;
    expect(module.content).toContain("EventsGateway");
    expect(module.content).toContain("AuthModule");
  });

  it("injects EventsGateway into entity service and broadcasts CRUD events when broadcastCrud is true", () => {
    const project = createProject("WS CRUD API");
    project.settings.websockets.enabled = true;
    project.settings.websockets.broadcastCrud = true;

    const taskEntity = createEntity("Task");
    taskEntity.fields.push(createField("title", "string"));
    project.entities.push(taskEntity);

    const ir = buildIR(project);
    const taskIR = ir.entities.find((e) => e.name === "Task")!;
    const serviceFile = emitService(ir, taskIR);

    expect(serviceFile.content).toContain("EventsGateway");
    expect(serviceFile.content).toContain("@Optional() private readonly eventsGateway?: EventsGateway");
    expect(serviceFile.content).toContain("this.eventsGateway?.emitEntityEvent(\"Task\", \"created\", saved)");
    expect(serviceFile.content).toContain("this.eventsGateway?.emitEntityEvent(\"Task\", \"updated\", saved)");
    expect(serviceFile.content).toContain("this.eventsGateway?.emitEntityEvent(\"Task\", \"deleted\", { id })");
  });

  it("integrates into generateProject, package.json, and app.module", async () => {
    const project = createProject("Full WS API");
    project.settings.websockets.enabled = true;

    const result = await generateProject(project, { format: false });

    // package.json dependencies
    const packageJson = result.files.find((f) => f.path === "package.json")!;
    expect(packageJson.content).toContain("@nestjs/websockets");
    expect(packageJson.content).toContain("@nestjs/platform-socket.io");
    expect(packageJson.content).toContain("socket.io");

    // app.module.ts import
    const appModule = result.files.find((f) => f.path === "src/app.module.ts")!;
    expect(appModule.content).toContain("EventsModule");
  });
});

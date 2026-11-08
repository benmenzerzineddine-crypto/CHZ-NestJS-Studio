import { describe, expect, it } from "vitest";
import { buildIR } from "../ir/build";
import { createProject } from "../model/defaults";
import { projectSchema } from "../model/schema";
import { emitRefreshTokenEntity } from "./users/entities";
import { emitAuth } from "./auth";
import { emitAuthService } from "./auth/service";
import { emitAuthController } from "./auth/controller";
import { emitAuthSpec } from "./tests/auth-spec";
import { buildSystemRoutes } from "../../features/endpoints/route-builder";

describe("Active sessions & refresh token revocation", () => {
  it("rejects sessionManagement when refreshTokens is false in schema", () => {
    const project = createProject("Test API", "postgres", true);
    project.auth.refreshTokens = false;
    project.auth.sessionManagement = true;

    const result = projectSchema.safeParse(project);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Session management requires refresh tokens to be enabled",
      );
    }
  });

  it("emits userAgent and ipAddress columns on RefreshToken entity", () => {
    const project = createProject("Test API", "postgres", true);
    project.auth.refreshTokens = true;
    project.auth.sessionManagement = true;

    const ir = buildIR(project);
    const entityFile = emitRefreshTokenEntity(ir);

    expect(entityFile.content).toContain('name: "user_agent", type: "varchar", length: 500');
    expect(entityFile.content).toContain("userAgent?: string | null;");
    expect(entityFile.content).toContain('name: "ip_address", type: "varchar", length: 45');
    expect(entityFile.content).toContain("ipAddress?: string | null;");
  });

  it("emits SessionDto file when sessionManagement is enabled", () => {
    const project = createProject("Test API", "postgres", true);
    project.auth.refreshTokens = true;
    project.auth.sessionManagement = true;

    const ir = buildIR(project);
    const files = emitAuth(ir);
    const sessionDtoFile = files.find((f) => f.path === "src/auth/dto/session.dto.ts");

    expect(sessionDtoFile).toBeDefined();
    expect(sessionDtoFile?.content).toContain("export class SessionDto {");
    expect(sessionDtoFile?.content).toContain("id: string;");
    expect(sessionDtoFile?.content).toContain("userAgent?: string | null;");
    expect(sessionDtoFile?.content).toContain("ipAddress?: string | null;");
  });

  it("emits session methods and headers in AuthService and AuthController", () => {
    const project = createProject("Test API", "postgres", true);
    project.auth.refreshTokens = true;
    project.auth.sessionManagement = true;

    const ir = buildIR(project);
    const service = emitAuthService(ir);
    const controller = emitAuthController(ir);

    // AuthService
    expect(service.content).toContain("listSessions(userId: string)");
    expect(service.content).toContain("revokeSession(userId: string, sessionId: string)");
    expect(service.content).toContain("revokeAllSessions(userId: string)");
    expect(service.content).toContain("userAgent: userAgent ?? null");
    expect(service.content).toContain("ipAddress: ipAddress ?? null");

    // AuthController
    expect(controller.content).toContain("@Get('sessions')");
    expect(controller.content).toContain("@Delete('sessions/:id')");
    expect(controller.content).toContain("@Delete('sessions')");
    expect(controller.content).toContain("@Headers('user-agent') userAgent?: string");
    expect(controller.content).toContain("@Ip() ipAddress?: string");
  });

  it("includes /auth/sessions in buildSystemRoutes", () => {
    const project = createProject("Test API", "postgres", true);
    project.auth.refreshTokens = true;
    project.auth.sessionManagement = true;

    const routes = buildSystemRoutes(project);
    const sessionRoutes = routes.filter((r) => r.path.includes("/auth/sessions"));

    expect(sessionRoutes).toHaveLength(3);
    expect(sessionRoutes.some((r) => r.method === "GET" && r.path === "/api/auth/sessions")).toBe(true);
    expect(sessionRoutes.some((r) => r.method === "DELETE" && r.path === "/api/auth/sessions/:id")).toBe(true);
    expect(sessionRoutes.some((r) => r.method === "DELETE" && r.path === "/api/auth/sessions")).toBe(true);
  });

  it("emits session management lifecycle test in emitAuthSpec", () => {
    const project = createProject("Test API", "postgres", true);
    project.auth.refreshTokens = true;
    project.auth.sessionManagement = true;

    const ir = buildIR(project);
    const spec = emitAuthSpec(ir);

    expect(spec.content).toContain('it("manages active sessions lifecycle"');
    expect(spec.content).toContain('/auth/sessions');
  });
});

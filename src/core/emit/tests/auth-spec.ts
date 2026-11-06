import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { USER_ENTITY_PATH, file } from "../helpers";
import { apiBase, importPath } from "./common";

export function emitAuthSpec(ir: ProjectIR): GeneratedFile {
  const register = ir.auth.registerEnabled;
  const refresh = ir.auth.refreshTokens;
  const defaultRole = JSON.stringify(ir.auth.defaultRole);
  const api = apiBase(ir);

  const lines: string[] = [];
  lines.push('import { INestApplication } from "@nestjs/common";');
  lines.push('import { JwtService } from "@nestjs/jwt";');
  lines.push('import { randomUUID } from "node:crypto";');
  lines.push('import request from "supertest";');
  lines.push('import { DataSource } from "typeorm";');
  lines.push(`import { User } from "${importPath(USER_ENTITY_PATH)}";`);
  lines.push('import { AuthService } from "../src/auth/auth.service";');
  lines.push('import { TEST_PASSWORD, authHeader, createTestApp, createUser } from "./utils/auth";');
  lines.push("");
  lines.push("jest.setTimeout(30_000);");
  lines.push("");
  lines.push("interface AuthResponse {");
  lines.push("  accessToken: string;");
  lines.push("  refreshToken?: string;");
  lines.push("  user: User;");
  lines.push("}");
  lines.push("");
  lines.push('describe("authentication", () => {');
  lines.push("  let app: INestApplication;");
  lines.push("  let user: User;");
  lines.push("  let tokens: AuthResponse;");
  lines.push("");
  lines.push("  beforeAll(async () => {");
  lines.push("    app = await createTestApp();");
  lines.push(`    user = await createUser(app, [${defaultRole}]);`);
  lines.push(`    const response = await request(app.getHttpServer()).post("${api}/auth/login").send({`);
  lines.push("      email: user.email,");
  lines.push("      password: TEST_PASSWORD,");
  lines.push("    });");
  lines.push("    expect(response.status).toBe(200);");
  lines.push("    tokens = response.body as AuthResponse;");
  lines.push("  });");
  lines.push("");
  lines.push("  afterAll(async () => {");
  lines.push("    await app.close();");
  lines.push("  });");
  lines.push("");
  lines.push('  it("logs in with valid credentials", () => {');
  lines.push("    expect(tokens.accessToken).toBeTruthy();");
  lines.push("    expect(tokens.user.email).toBe(user.email);");
  lines.push("    expect(tokens.user.passwordHash).toBeUndefined();");
  lines.push("  });");
  lines.push("");
  lines.push('  it("rejects invalid credentials", async () => {');
  lines.push(`    const response = await request(app.getHttpServer()).post("${api}/auth/login").send({`);
  lines.push("      email: user.email,");
  lines.push('      password: "definitely-wrong",');
  lines.push("    });");
  lines.push("    expect(response.status).toBe(401);");
  lines.push("  });");
  lines.push("");
  lines.push('  it("rejects missing, expired and invalid access tokens", async () => {');
  lines.push(`    const missing = await request(app.getHttpServer()).get("${api}/auth/me");`);
  lines.push("    expect(missing.status).toBe(401);");
  lines.push(
    `    const invalid = await request(app.getHttpServer()).get("${api}/auth/me").set(authHeader("not-a-token"));`,
  );
  lines.push("    expect(invalid.status).toBe(401);");
  lines.push("    const jwt = app.get(JwtService);");
  lines.push(
    "    const expired = await jwt.signAsync({ sub: user.id, email: user.email, roles: user.roles }, { expiresIn: -1 });",
  );
  lines.push(
    `    const expiredResponse = await request(app.getHttpServer()).get("${api}/auth/me").set(authHeader(expired));`,
  );
  lines.push("    expect(expiredResponse.status).toBe(401);");
  lines.push("  });");
  lines.push("");
  lines.push('  it("returns the current user", async () => {');
  lines.push(
    `    const response = await request(app.getHttpServer()).get("${api}/auth/me").set(authHeader(tokens.accessToken));`,
  );
  lines.push("    expect(response.status).toBe(200);");
  lines.push("    expect(response.body.email).toBe(user.email);");
  lines.push("    expect(response.body.passwordHash).toBeUndefined();");
  lines.push("  });");

  if (register) {
    lines.push("");
    lines.push('  it("registers a new user", async () => {');
    lines.push("    const email = `registered-${randomUUID()}@example.com`;");
    lines.push(`    const response = await request(app.getHttpServer()).post("${api}/auth/register").send({`);
    lines.push("      email,");
    lines.push("      password: TEST_PASSWORD,");
    lines.push("    });");
    lines.push("    expect(response.status).toBe(201);");
    lines.push("    expect(response.body.accessToken).toBeTruthy();");
    lines.push("    expect(response.body.user.email).toBe(email);");
    lines.push("    expect(response.body.user.passwordHash).toBeUndefined();");
    lines.push("");
    lines.push(`    const duplicate = await request(app.getHttpServer()).post("${api}/auth/register").send({`);
    lines.push("      email,");
    lines.push("      password: TEST_PASSWORD,");
    lines.push("    });");
    lines.push("    expect(duplicate.status).toBe(409);");
    lines.push("  });");
  }

  if (refresh) {
    lines.push("");
    lines.push('  it("rotates refresh tokens and revokes them on logout", async () => {');
    lines.push("    expect(tokens.refreshToken).toBeTruthy();");
    lines.push(
      `    const refreshed = await request(app.getHttpServer()).post("${api}/auth/refresh").send({ refreshToken: tokens.refreshToken });`,
    );
    lines.push("    expect(refreshed.status).toBe(200);");
    lines.push("    const next = refreshed.body as AuthResponse;");
    lines.push("    expect(next.refreshToken).toBeTruthy();");
    lines.push("    expect(next.refreshToken).not.toBe(tokens.refreshToken);");
    lines.push("");
    lines.push(
      `    const reused = await request(app.getHttpServer()).post("${api}/auth/refresh").send({ refreshToken: tokens.refreshToken });`,
    );
    lines.push("    expect(reused.status).toBe(401);");
    lines.push("");
    lines.push("    const jwt = app.get(JwtService);");
    lines.push(
      "    const expired = await jwt.signAsync({ sub: user.id, email: user.email, roles: user.roles }, { expiresIn: -1 });",
    );
    lines.push(
      `    const logout = await request(app.getHttpServer()).post("${api}/auth/logout").set(authHeader(expired)).send({ refreshToken: next.refreshToken });`,
    );
    lines.push("    expect(logout.status).toBe(200);");
    lines.push(
      `    const afterLogout = await request(app.getHttpServer()).post("${api}/auth/refresh").send({ refreshToken: next.refreshToken });`,
    );
    lines.push("    expect(afterLogout.status).toBe(401);");
    lines.push("  });");
    lines.push("");
    lines.push('  it("rejects inactive users on login and refresh", async () => {');
    lines.push(`    const inactive = await createUser(app, [${defaultRole}]);`);
    lines.push("    const auth = app.get(AuthService);");
    lines.push(
      "    const loggedIn = await auth.login({ email: inactive.email, password: TEST_PASSWORD });",
    );
    lines.push("    const dataSource = app.get(DataSource);");
    lines.push("    await dataSource.getRepository(User).update(inactive.id, { isActive: false });");
    lines.push(`    const loginResponse = await request(app.getHttpServer()).post("${api}/auth/login").send({`);
    lines.push("      email: inactive.email,");
    lines.push("      password: TEST_PASSWORD,");
    lines.push("    });");
    lines.push("    expect(loginResponse.status).toBe(401);");
    lines.push(`    const response = await request(app.getHttpServer()).post("${api}/auth/refresh").send({`);
    lines.push("      refreshToken: loggedIn.refreshToken,");
    lines.push("    });");
    lines.push("    expect(response.status).toBe(401);");
    lines.push("  });");
  }

  lines.push("");
  lines.push('  it("changes the current password", async () => {');
  if (refresh) {
    lines.push("    const auth = app.get(AuthService);");
    lines.push(
      "    const beforeChange = await auth.login({ email: user.email, password: TEST_PASSWORD });",
    );
    lines.push("    expect(beforeChange.refreshToken).toBeTruthy();");
  }
  lines.push(
    `    const changed = await request(app.getHttpServer()).post("${api}/users/change-password").set(authHeader(tokens.accessToken)).send({`,
  );
  lines.push("      currentPassword: TEST_PASSWORD,");
  lines.push('      newPassword: "NewPassword123!",');
  lines.push("    });");
  lines.push("    expect(changed.status).toBe(200);");
  if (refresh) {
    lines.push(
      `    const staleRefresh = await request(app.getHttpServer()).post("${api}/auth/refresh").send({ refreshToken: beforeChange.refreshToken });`,
    );
    lines.push("    expect(staleRefresh.status).toBe(401);");
  }
  lines.push("");
  lines.push(`    const oldLogin = await request(app.getHttpServer()).post("${api}/auth/login").send({`);
  lines.push("      email: user.email,");
  lines.push("      password: TEST_PASSWORD,");
  lines.push("    });");
  lines.push("    expect(oldLogin.status).toBe(401);");
  lines.push("");
  lines.push(`    const newLogin = await request(app.getHttpServer()).post("${api}/auth/login").send({`);
  lines.push("      email: user.email,");
  lines.push('      password: "NewPassword123!",');
  lines.push("    });");
  lines.push("    expect(newLogin.status).toBe(200);");
  lines.push("  });");

  if (ir.auth.passwordReset) {
    lines.push("");
    lines.push('  it("completes the password reset lifecycle", async () => {');
    lines.push("    const forgotRes = await request(app.getHttpServer())");
    lines.push(`      .post("${api}/auth/forgot-password")`);
    lines.push("      .send({ email: user.email });");
    lines.push("    expect(forgotRes.status).toBe(200);");
    lines.push("");
    lines.push("    const ds = app.get(DataSource);");
    lines.push('    const resetRepo = ds.getRepository("password_resets");');
    lines.push("    const record = await resetRepo.findOne({ where: { userId: user.id } });");
    lines.push("    expect(record).toBeTruthy();");
    lines.push("    expect(record.usedAt).toBeNull();");
    lines.push("");
    lines.push("    const testToken = `reset-${randomUUID()}`;");
    lines.push('    const testHash = require("node:crypto").createHash("sha256").update(testToken).digest("hex");');
    lines.push("    await resetRepo.save(");
    lines.push("      resetRepo.create({");
    lines.push("        tokenHash: testHash,");
    lines.push("        userId: user.id,");
    lines.push("        expiresAt: new Date(Date.now() + 3600000),");
    lines.push("      }),");
    lines.push("    );");
    lines.push("");
    lines.push("    const resetRes = await request(app.getHttpServer())");
    lines.push(`      .post("${api}/auth/reset-password")`);
    lines.push('      .send({ token: testToken, newPassword: "ResetPassword123!" });');
    lines.push("    expect(resetRes.status).toBe(200);");
    lines.push("");
    lines.push("    const oldLogin = await request(app.getHttpServer())");
    lines.push(`      .post("${api}/auth/login")`);
    lines.push("      .send({ email: user.email, password: TEST_PASSWORD });");
    lines.push("    expect(oldLogin.status).toBe(401);");
    lines.push("");
    lines.push("    const newLogin = await request(app.getHttpServer())");
    lines.push(`      .post("${api}/auth/login")`);
    lines.push('      .send({ email: user.email, password: "ResetPassword123!" });');
    lines.push("    expect(newLogin.status).toBe(200);");
    lines.push("  });");
  }

  if (ir.auth.emailVerification) {
    lines.push("");
    lines.push('  it("verifies user email address", async () => {');
    lines.push("    const ds = app.get(DataSource);");
    lines.push('    const verifRepo = ds.getRepository("email_verifications");');
    lines.push('    const userRepo = ds.getRepository("User");');
    lines.push("");
    lines.push("    const verifyToken = `verify-${randomUUID()}`;");
    lines.push('    const tokenHash = require("node:crypto").createHash("sha256").update(verifyToken).digest("hex");');
    lines.push("    await verifRepo.save(");
    lines.push("      verifRepo.create({");
    lines.push("        tokenHash,");
    lines.push("        userId: user.id,");
    lines.push("        expiresAt: new Date(Date.now() + 86400000),");
    lines.push("      }),");
    lines.push("    );");
    lines.push("");
    lines.push("    const verifyRes = await request(app.getHttpServer())");
    lines.push(`      .post("${api}/auth/verify-email")`);
    lines.push("      .send({ token: verifyToken });");
    lines.push("    expect(verifyRes.status).toBe(200);");
    lines.push("");
    lines.push("    const updatedUser = await userRepo.findOne({ where: { id: user.id } });");
    lines.push("    expect(updatedUser.emailVerifiedAt).toBeTruthy();");
    lines.push("  });");
  }

  lines.push("});");

  return file("test/auth.e2e-spec.ts", lines.join("\n") + "\n", "typescript");
}

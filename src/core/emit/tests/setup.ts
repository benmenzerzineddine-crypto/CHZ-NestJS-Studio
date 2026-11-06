import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { file } from "../helpers";
import { apiBase } from "./common";

export function emitJestConfig(): GeneratedFile {
  return file(
    "test/jest-e2e.json",
    `${JSON.stringify(
      {
        moduleFileExtensions: ["js", "json", "ts"],
        rootDir: "..",
        testEnvironment: "node",
        testRegex: "test/.*\\.e2e-spec\\.ts$",
        maxWorkers: 1,
        transform: { "^.+\\.(t|j)s$": "ts-jest" },
        setupFiles: ["<rootDir>/test/setup-e2e.ts"],
      },
      null,
      2,
    )}\n`,
    "json",
  );
}

export function emitSetup(ir: ProjectIR): GeneratedFile {
  const sqlite =
    ir.driver === "sqlite"
      ? '\nprocess.env.DB_TYPE = "sqlite";\nprocess.env.DB_DATABASE = ":memory:";'
      : `\nprocess.env.DB_TYPE = ${JSON.stringify(ir.driver)};`;

  return file(
    "test/setup-e2e.ts",
    `process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-change-me";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-change-me";
process.env.SEED_ADMIN = "false";${sqlite}
`,
    "typescript",
  );
}

export function emitAuthUtils(ir: ProjectIR): GeneratedFile {
  const content = `import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { User } from "../../src/users/entities/user.entity";
import { UsersService } from "../../src/users/users.service";

export const TEST_PASSWORD = "Password123!";

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(${JSON.stringify(ir.apiPrefix)});
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

export async function createUser(app: INestApplication, roles: string[]): Promise<User> {
  const users = app.get(UsersService);
  const email = \`user-\${randomUUID()}@example.com\`;
  return users.create(email, TEST_PASSWORD, roles);
}

export async function login(
  app: INestApplication,
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const response = await request(app.getHttpServer()).post("${apiBase(ir)}/auth/login").send({
    email,
    password,
  });
  if (response.status !== 200) {
    throw new Error(\`Login failed for \${email}: \${response.status} \${JSON.stringify(response.body)}\`);
  }
  return response.body.accessToken as string;
}

export function authHeader(token?: string | null): Record<string, string> {
  return token ? { Authorization: \`Bearer \${token}\` } : {};
}
`;
  return file("test/utils/auth.ts", content, "typescript");
}

export function emitDbUtils(): GeneratedFile {
  const content = `import { randomUUID } from "node:crypto";

export function listItems(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>;
  if (body && typeof body === "object" && "data" in body) {
    const data = (body as { data?: unknown }).data;
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  }
  return [];
}

export function unique(prefix: string): string {
  return \`\${prefix}-\${randomUUID().slice(0, 8)}\`;
}
`;
  return file("test/utils/db.ts", content, "typescript");
}

export function emitHealthSpec(ir: ProjectIR): GeneratedFile {
  return file(
    "test/health.e2e-spec.ts",
    `import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./utils/auth";

jest.setTimeout(30_000);

describe("health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the health endpoint", async () => {
    const response = await request(app.getHttpServer()).get("${apiBase(ir)}/health");
    expect(response.status).toBe(200);
  });
});
`,
    "typescript",
  );
}

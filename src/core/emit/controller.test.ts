import { describe, expect, it } from "vitest";
import { emitAppModule } from "./config";
import { emitController } from "./controller";
import { emitAuthBasics } from "./auth-basics";
import { buildIR } from "../ir/build";
import { createEntity, createProject } from "../model/defaults";
import type { AccessLevel, Operation } from "../model/schema";

const OPERATIONS: Operation[] = ["list", "read", "create", "update", "delete"];
const LEVELS: AccessLevel[] = ["public", "authenticated", "roles", "owner"];

const METHODS: Record<Operation, string> = {
  list: "@Get()",
  read: "@Get(':id')",
  create: "@Post()",
  update: "@Patch(':id')",
  delete: "@Delete(':id')",
};

function projectIR(authEnabled: boolean) {
  const project = createProject("Access matrix", "postgres", authEnabled);
  project.entities.push(createEntity("Post"));
  return buildIR(project);
}

function methodBlock(content: string, operation: Operation): string {
  const marker = `  ${METHODS[operation]}`;
  const start = content.indexOf(marker);
  if (start === -1) throw new Error(`Missing ${METHODS[operation]}`);
  const previousBlank = content.lastIndexOf("\n\n", start);
  const end = content.indexOf("\n\n", start);
  return content.slice(previousBlank === -1 ? 0 : previousBlank, end === -1 ? content.length : end);
}

describe("access decorators", () => {
  it.each(
    [true, false].flatMap((authEnabled) =>
      OPERATIONS.flatMap((operation) =>
        LEVELS.map((level) => ({ authEnabled, operation, level })),
      ),
    ),
  )("emits $level decorators for $operation with auth=$authEnabled", ({
    authEnabled,
    operation,
    level,
  }) => {
    const ir = projectIR(authEnabled);
    const entity = ir.entities.find((candidate) => candidate.name === "Post");
    if (!entity) throw new Error("Missing Post entity");
    entity.access[operation] = {
      level,
      roles: level === "roles" ? ["admin"] : undefined,
    };

    const content = emitController(ir, entity).content;
    const block = methodBlock(content, operation);

    if (!authEnabled) {
      expect(content).not.toContain("@Public");
      expect(content).not.toContain("@Roles");
      expect(content).not.toContain("@ApiBearerAuth");
      return;
    }

    if (level === "public") {
      expect(block).toContain("@Public()");
      expect(block).not.toContain("@ApiBearerAuth()");
      expect(block).not.toContain("@Roles(");
      return;
    }

    expect(block).toContain("@ApiBearerAuth()");
    expect(block).not.toContain("@Public()");

    if (level === "roles") {
      expect(block).toContain('@Roles("admin")');
      expect(block.indexOf("@ApiBearerAuth()")).toBeLessThan(block.indexOf("@Roles("));
    } else {
      expect(block).not.toContain("@Roles(");
    }

    if (level === "owner") {
      expect(block).toContain("Admin bypass and owner scoping");
    }
  });

  it("registers JwtAuthGuard before RolesGuard", () => {
    const content = emitAppModule(projectIR(true)).content;
    expect(content.indexOf("useClass: JwtAuthGuard")).toBeGreaterThan(-1);
    expect(content.indexOf("useClass: JwtAuthGuard")).toBeLessThan(
      content.indexOf("useClass: RolesGuard"),
    );
  });

  it("checks @Public at both handler and controller level", () => {
    const guard = emitAuthBasics(projectIR(true)).find((file) =>
      file.path.endsWith("jwt-auth.guard.ts"),
    );
    expect(guard?.content).toContain("context.getHandler()");
    expect(guard?.content).toContain("context.getClass()");
    expect(guard?.content).toContain("getAllAndOverride");
  });
});

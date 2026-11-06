import { describe, expect, it } from "vitest";
import { ImportRegistry, moduleImport } from "./imports";

describe("ImportRegistry", () => {
  it("dedupes and sorts named imports", () => {
    const registry = new ImportRegistry();
    registry.add("typeorm", "Column", "Entity", "Column");
    registry.add("typeorm", "PrimaryGeneratedColumn");

    expect(registry.render()).toBe(
      'import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";\n\n',
    );
  });

  it("keeps type imports separate and strips decorator prefixes", () => {
    const registry = new ImportRegistry();
    registry.add("typeorm", "@Entity", "@Column");
    registry.addType("typeorm", "SelectQueryBuilder");

    expect(registry.render()).toBe(
      'import { Column, Entity } from "typeorm";\nimport type { SelectQueryBuilder } from "typeorm";\n\n',
    );
  });

  it("supports default imports and side effects", () => {
    const registry = new ImportRegistry();
    registry.addSideEffect("reflect-metadata");
    registry.addDefault("bcrypt", "bcrypt");

    expect(registry.render()).toBe(
      'import "reflect-metadata";\nimport bcrypt from "bcrypt";\n\n',
    );
  });

  it("builds relative module paths", () => {
    expect(moduleImport("src/modules/post/post.entity.ts", "src/users/entities/user.entity.ts")).toBe(
      "../../users/entities/user.entity.ts",
    );
    expect(moduleImport("src/health/health.controller.ts", "src/auth/decorators/public.decorator.ts")).toBe(
      "../auth/decorators/public.decorator.ts",
    );
    expect(moduleImport("src/app.module.ts", "src/app.module.ts")).toBe("./app.module.ts");
  });
});

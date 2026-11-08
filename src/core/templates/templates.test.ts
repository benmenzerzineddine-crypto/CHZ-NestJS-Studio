import { describe, expect, it } from "vitest";
import { generateProject } from "../generate";
import { projectSchema } from "../model/schema";
import { validateProject } from "../validate/validate";
import {
  PROJECT_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
} from "./index";

describe("Project templates gallery", () => {
  it("provides all 4 core starter templates", () => {
    expect(PROJECT_TEMPLATES).toHaveLength(4);
    expect(PROJECT_TEMPLATES.map((t) => t.id)).toEqual([
      "saas",
      "ecommerce",
      "crm",
      "blog",
    ]);
  });

  it("finds templates by id and category", () => {
    expect(getTemplateById("saas")?.title).toBe("SaaS Starter");
    expect(getTemplateById("ecommerce")?.title).toBe("E-Commerce Starter");
    expect(getTemplateById("crm")?.title).toBe("CRM Starter");
    expect(getTemplateById("blog")?.title).toBe("Blog & CMS Starter");
    expect(getTemplateById("unknown")).toBeUndefined();

    expect(getTemplatesByCategory("saas")).toHaveLength(1);
    expect(getTemplatesByCategory("ecommerce")).toHaveLength(1);
  });

  for (const template of PROJECT_TEMPLATES) {
    describe(`template: ${template.title}`, () => {
      it("creates a project matching the projectSchema", () => {
        const project = template.createProject({
          name: `Custom ${template.title}`,
          driver: "postgres",
        });

        const parsed = projectSchema.safeParse(project);
        expect(parsed.success).toBe(true);
      });

      it("validates with 0 errors from validateProject", () => {
        const project = template.createProject({ driver: "postgres" });
        const issues = validateProject(project);
        const errors = issues.filter((i) => i.severity === "error");

        expect(errors).toEqual([]);
      });

      it("generates clean nestjs project tree files", async () => {
        const project = template.createProject({ driver: "sqlite" });
        const result = await generateProject(project);

        expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
        expect(result.files.length).toBeGreaterThan(15);

        // Core files check
        const paths = result.files.map((f) => f.path);
        expect(paths).toContain("src/main.ts");
        expect(paths).toContain("src/app.module.ts");
        expect(paths).toContain("src/auth/auth.service.ts");
        expect(paths).toContain("src/auth/auth.controller.ts");

        // Verify entity files exist
        for (const entityName of template.entities) {
          const kebab = entityName
            .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
            .toLowerCase();
          const hasEntity = paths.some(
            (p) => p.includes(kebab) && p.endsWith(".entity.ts"),
          );
          expect(hasEntity).toBe(true);
        }
      });
    });
  }
});

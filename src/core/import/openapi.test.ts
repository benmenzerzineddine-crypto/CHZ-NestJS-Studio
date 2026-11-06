import { describe, expect, it } from "vitest";
import { validateProject } from "../validate/validate";
import { parseOpenApi } from "./openapi";

describe("parseOpenApi", () => {
  it("parses OpenAPI 3.0 specification with schemas, enums, relations and custom paths", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Pet Store API", version: "1.0.0" },
      components: {
        schemas: {
          PetStatus: {
            type: "string",
            enum: ["available", "pending", "sold"],
          },
          Category: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
            },
            required: ["name"],
          },
          Pet: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              price: { type: "number", format: "float" },
              status: { enum: ["available", "pending", "sold"] },
              category: { $ref: "#/components/schemas/Category" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            required: ["name"],
          },
        },
      },
      paths: {
        "/pets/{id}/adopt": {
          post: {
            operationId: "adoptPet",
            summary: "Mark pet as adopted",
            tags: ["Pet"],
          },
        },
      },
    };

    const project = parseOpenApi(spec);

    expect(project.name).toBe("Pet Store API");

    const category = project.entities.find((e) => e.name === "Category");
    const pet = project.entities.find((e) => e.name === "Pet");

    expect(category).toBeDefined();
    expect(pet).toBeDefined();

    expect(pet?.options.timestamps).toBe(true);

    const priceField = pet?.fields.find((f) => f.name === "price");
    expect(priceField?.type).toBe("float");

    const categoryRel = pet?.relations.find((r) => r.name === "category");
    expect(categoryRel).toBeDefined();
    expect(categoryRel?.targetEntityId).toBe(category?.id);

    // Custom endpoint
    const adoptEndpoint = pet?.customEndpoints.find((ep) => ep.name === "adoptPet");
    expect(adoptEndpoint).toBeDefined();
    expect(adoptEndpoint?.method).toBe("POST");
    expect(adoptEndpoint?.path).toBe("/:id/adopt");

    const issues = validateProject(project);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

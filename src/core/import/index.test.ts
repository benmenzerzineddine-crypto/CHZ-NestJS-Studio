import { describe, expect, it } from "vitest";
import { detectFormat, importProject } from "./index";

describe("importProject & detectFormat", () => {
  it("detects SQL format automatically", () => {
    const sql = `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(100));`;
    expect(detectFormat(sql)).toBe("sql");

    const project = importProject({ content: sql, projectName: "Detected SQL" });
    expect(project.name).toBe("Detected SQL");
    expect(project.entities.some((e: { name: string }) => e.name === "Item")).toBe(true);
  });

  it("detects TypeORM format automatically", () => {
    const code = `
      @Entity('books')
      export class Book {
        @PrimaryGeneratedColumn()
        id: number;
        @Column()
        title: string;
      }
    `;
    expect(detectFormat(code)).toBe("typeorm");

    const project = importProject({ content: code, projectName: "Detected TypeORM" });
    expect(project.entities.some((e: { name: string }) => e.name === "Book")).toBe(true);
  });

  it("detects OpenAPI JSON format automatically", () => {
    const openapi = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "OpenAPI API" },
      components: {
        schemas: {
          Car: {
            type: "object",
            properties: { make: { type: "string" } },
          },
        },
      },
    });
    expect(detectFormat(openapi)).toBe("openapi");

    const project = importProject({ content: openapi });
    expect(project.entities.some((e: { name: string }) => e.name === "Car")).toBe(true);
  });
});

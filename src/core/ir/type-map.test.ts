import { describe, expect, it } from "vitest";
import type { Driver, FieldDef } from "../model/schema";
import {
  columnDecorator,
  columnOptions,
  defaultValueLiteral,
  mapFieldType,
  primaryColumnDecorator,
  validatorInfo,
} from "./type-map";

function field(type: FieldDef["type"], overrides: Partial<FieldDef> = {}): FieldDef {
  return {
    id: "fld_test",
    name: "sample_value",
    type,
    required: true,
    unique: false,
    indexed: false,
    primary: false,
    ...overrides,
  };
}

describe("mapFieldType", () => {
  const drivers: Driver[] = ["postgres", "mysql", "sqlite"];

  it.each(drivers)("maps scalar types for %s", (driver) => {
    expect(mapFieldType(field("string"), driver)).toMatchObject({ tsType: "string", columnType: "varchar" });
    expect(mapFieldType(field("text"), driver)).toMatchObject({ tsType: "string", columnType: "text" });
    expect(mapFieldType(field("int"), driver).tsType).toBe("number");
    expect(mapFieldType(field("float"), driver).tsType).toBe("number");
    expect(mapFieldType(field("decimal"), driver)).toMatchObject({ tsType: "string", columnType: "decimal" });
    expect(mapFieldType(field("boolean"), driver)).toMatchObject({ tsType: "boolean", columnType: "boolean" });
    expect(mapFieldType(field("date"), driver)).toMatchObject({ tsType: "Date", columnType: "date" });
    expect(mapFieldType(field("datetime"), driver).tsType).toBe("Date");
    expect(mapFieldType(field("uuid"), driver).tsType).toBe("string");
    expect(mapFieldType(field("json"), driver).tsType).toBe("Record<string, unknown>");
  });

  it("uses native uuid and enum types on postgres", () => {
    expect(mapFieldType(field("uuid"), "postgres")).toMatchObject({ columnType: "uuid" });
    expect(mapFieldType(field("enum"), "postgres", "PostStatus")).toEqual({
      tsType: "PostStatus",
      columnType: "enum",
    });
    expect(mapFieldType(field("json"), "postgres").columnType).toBe("jsonb");
  });

  it("uses varchar and simple-json fallbacks on sqlite and mysql", () => {
    expect(mapFieldType(field("uuid"), "sqlite")).toMatchObject({ columnType: "varchar", length: 36 });
    expect(mapFieldType(field("enum"), "mysql", "PostStatus")).toMatchObject({
      columnType: "varchar",
      length: 255,
    });
    expect(mapFieldType(field("json"), "sqlite").columnType).toBe("simple-json");
    expect(mapFieldType(field("json"), "mysql").columnType).toBe("json");
  });
});

describe("column options", () => {
  it("emits snake_case names, nullability, length, unique and defaults", () => {
    const decorator = columnDecorator(
      field("string", { required: false, unique: true, defaultValue: "draft" }),
      "postgres",
      "posts",
    );
    expect(decorator).toContain('name: \'sample_value\'');
    expect(decorator).toContain("nullable: true");
    expect(decorator).toContain("unique: true");
    expect(decorator).toContain("default: 'draft'");
    expect(decorator).toContain("length: 255");
  });

  it("emits a postgres enum with a table-scoped enum name", () => {
    const options = columnOptions(field("enum"), "postgres", "posts", "PostStatus");
    expect(options).toContain("type: 'enum'");
    expect(options).toContain("enum: PostStatus");
    expect(options).toContain("enumName: 'posts_sample_value'");
  });

  it("emits precision and scale for decimal columns", () => {
    const options = columnOptions(
      field("decimal", { column: { precision: 10, scale: 2 } }),
      "postgres",
      "prices",
    );
    expect(options).toContain("precision: 10");
    expect(options).toContain("scale: 2");
  });

  it("uses generated primary column decorators for uuid and int", () => {
    expect(primaryColumnDecorator(field("uuid", { name: "id" }))).toBe(
      '@PrimaryGeneratedColumn(\'uuid\', { name: \'id\' })',
    );
    expect(primaryColumnDecorator(field("int", { name: "postId" }))).toBe(
      '@PrimaryGeneratedColumn({ name: \'post_id\' })',
    );
  });
});

describe("default values", () => {
  it("normalizes booleans and numeric defaults", () => {
    expect(defaultValueLiteral(field("boolean", { defaultValue: "true" }))).toBe("true");
    expect(defaultValueLiteral(field("int", { defaultValue: "42" }))).toBe("42");
    expect(defaultValueLiteral(field("float", { defaultValue: "-1.5" }))).toBe("-1.5");
  });

  it("quotes strings, dates and invalid numerics", () => {
    expect(defaultValueLiteral(field("string", { defaultValue: "it's" }))).toBe("'it\\'s'");
    expect(defaultValueLiteral(field("date", { defaultValue: "2026-01-01" }))).toBe("'2026-01-01'");
    expect(defaultValueLiteral(field("int", { defaultValue: "nope" }))).toBe("'nope'");
  });

  it("drops json defaults because they cannot be represented portably", () => {
    expect(defaultValueLiteral(field("json", { defaultValue: "{}" }))).toBeUndefined();
  });
});

describe("validatorInfo", () => {
  it("marks non-required fields optional and applies string validators", () => {
    const info = validatorInfo(
      field("string", {
        required: false,
        column: { length: 80 },
        validators: { minLength: 2, pattern: "^[a-z]+$" },
      }),
    );
    expect(info.decorators).toEqual([
      "@IsOptional()",
      "@IsString()",
      "@MaxLength(80)",
      "@MinLength(2)",
      '@Matches(new RegExp("^[a-z]+$"))',
    ]);
    expect(info.imports).toEqual(
      expect.arrayContaining(["IsOptional", "IsString", "MaxLength", "MinLength", "Matches"]),
    );
  });

  it.each([
    ["int", "@IsInt()"],
    ["float", "@IsNumber()"],
    ["decimal", "@IsNumberString()"],
    ["boolean", "@IsBoolean()"],
    ["date", "@IsDateString()"],
    ["datetime", "@IsDateString()"],
    ["uuid", "@IsUUID()"],
    ["json", "@IsObject()"],
  ] as const)("maps %s to %s", (type, decoratorName) => {
    expect(validatorInfo(field(type)).decorators).toContain(decoratorName);
  });

  it("uses the enum class for enum validation", () => {
    expect(validatorInfo(field("enum"), "PostStatus").decorators).toEqual(["@IsEnum(PostStatus)"]);
  });
});

import type { RelationKind } from "../../model/schema";
import type { ParsedTypeOrmEntity } from "./types";
import { inferTypeFromTsType, inferTypeFromColumnDecorator } from "./infer";

export function parseEntityClasses(source: string): ParsedTypeOrmEntity[] {
  const entities: ParsedTypeOrmEntity[] = [];

  // Match class with optional @Entity() decorator
  const classRegex = /(?:@Entity\s*\(\s*(?:['"](\w+)['"])?\s*\)\s*)?(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{([\s\S]*?)\n\s*\}/g;

  let classMatch: RegExpExecArray | null;
  while ((classMatch = classRegex.exec(source)) !== null) {
    const rawTableName = classMatch[1];
    const className = classMatch[2];
    const body = classMatch[3];

    if (!className || !body) continue;

    const parsedEntity: ParsedTypeOrmEntity = {
      className,
      tableName: rawTableName || className,
      fields: [],
      relations: [],
      hasTimestamps: false,
      hasSoftDelete: false,
    };

    // Parse member lines
    const propertyRegex = /(?:@([A-Za-z0-9]+)\s*\(([\s\S]*?)\)\s*)*(?:@([A-Za-z0-9]+)\s*\(([\s\S]*?)\)\s*)*(\w+)(?:\?)?:\s*([^;]+);/g;

    let propMatch: RegExpExecArray | null;
    while ((propMatch = propertyRegex.exec(body)) !== null) {
      const fullMatch = propMatch[0];
      const propName = propMatch[5];
      const rawTsType = propMatch[6]?.trim() || "string";

      if (!propName) continue;

      if (fullMatch.includes("@CreateDateColumn") || fullMatch.includes("@UpdateDateColumn")) {
        parsedEntity.hasTimestamps = true;
        continue;
      }
      if (fullMatch.includes("@DeleteDateColumn")) {
        parsedEntity.hasSoftDelete = true;
        continue;
      }

      // Check PrimaryGeneratedColumn
      if (fullMatch.includes("@PrimaryGeneratedColumn") || fullMatch.includes("@PrimaryColumn")) {
        const isUuid = fullMatch.includes("'uuid'") || rawTsType.toLowerCase().includes("string");
        parsedEntity.fields.push({
          name: propName,
          type: isUuid ? "uuid" : "int",
          primary: true,
          required: true,
          unique: true,
        });
        continue;
      }

      // Check Relations
      if (fullMatch.includes("@OneToMany")) {
        // One-to-many relations are derived automatically from owning many-to-one relations
        continue;
      }

      if (fullMatch.includes("@ManyToOne") || fullMatch.includes("@OneToOne") || fullMatch.includes("@ManyToMany")) {
        let kind: RelationKind = "many-to-one";
        if (fullMatch.includes("@OneToOne")) kind = "one-to-one";
        else if (fullMatch.includes("@ManyToMany")) kind = "many-to-many";

        // Find target class: @ManyToOne(() => Target, ...)
        const targetMatch = fullMatch.match(/=>\s*([A-Za-z0-9_]+)/);
        const targetClass = targetMatch ? targetMatch[1] : rawTsType.replace(/\[\]/g, "").trim();

        const nullable = /nullable:\s*true/.test(fullMatch) || fullMatch.includes("?:");
        const cascade = /cascade:\s*true/.test(fullMatch);

        parsedEntity.relations.push({
          name: propName,
          targetClassName: targetClass,
          kind,
          nullable,
          cascade,
        });
        continue;
      }

      // Ordinary Column
      if (fullMatch.includes("@Column")) {
        const colDecMatch = fullMatch.match(/@Column\s*\(([\s\S]*?)\)/);
        const decOpts = colDecMatch ? colDecMatch[1] : "";
        const inferred = inferTypeFromColumnDecorator(decOpts);

        const fieldType = inferred.type !== "string" ? inferred.type : inferTypeFromTsType(rawTsType);
        const isNullable = inferred.nullable || fullMatch.includes("?:");

        parsedEntity.fields.push({
          name: propName,
          type: fieldType,
          enumName: inferred.enumName,
          required: !isNullable,
          unique: inferred.unique,
          primary: false,
        });
      }
    }

    entities.push(parsedEntity);
  }

  return entities;
}

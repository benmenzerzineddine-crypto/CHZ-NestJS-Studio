import type { Driver, FieldType, RelationKind } from "../../model/schema";

export interface TypeOrmImportOptions {
  projectName?: string;
  driver?: Driver;
  defaultAuth?: boolean;
}

export interface ParsedTypeOrmField {
  name: string;
  type: FieldType;
  enumName?: string;
  required: boolean;
  unique: boolean;
  primary: boolean;
}

export interface ParsedTypeOrmRelation {
  name: string;
  targetClassName: string;
  kind: RelationKind;
  nullable: boolean;
  cascade: boolean;
}

export interface ParsedTypeOrmEntity {
  className: string;
  tableName: string;
  fields: ParsedTypeOrmField[];
  relations: ParsedTypeOrmRelation[];
  hasTimestamps: boolean;
  hasSoftDelete: boolean;
}

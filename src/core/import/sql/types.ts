import type { Driver, FieldType } from "../../model/schema";

export interface ParsedColumn {
  name: string;
  type: FieldType;
  enumName?: string;
  enumValues?: string[];
  required: boolean;
  unique: boolean;
  primary: boolean;
  reference?: {
    table: string;
    column: string;
    cascade?: boolean;
  };
}

export interface ParsedTable {
  rawName: string;
  entityName: string;
  columns: ParsedColumn[];
  foreignKeys: Array<{
    column: string;
    targetTable: string;
    targetColumn: string;
    cascade?: boolean;
  }>;
  primaryKeys: string[];
}

export interface SqlImportOptions {
  projectName?: string;
  driver?: Driver;
  defaultAuth?: boolean;
}

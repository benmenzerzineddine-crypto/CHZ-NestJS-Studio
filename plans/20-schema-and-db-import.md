# Step 20 — Reverse Engineering & Schema Import (M5n)

**Goal:** Enable developers to import existing schemas into `chz-nest` to instantly generate and configure full NestJS + TypeORM projects without manual re-typing.

- **Depends on:** [`19-heroui-migration.md`](19-heroui-migration.md) (M5m accepted)
- **Plan reference:** `plan.md` §2, §9, §12; [`plans/06-later.md`](06-later.md)
- **Status:** in progress

---

## 1. Objectives & Architectural Invariants

1. **Format Versatility:**
   Support three primary import sources:
   - **SQL DDL (`CREATE TABLE ...`)**: PostgreSQL, MySQL, SQLite schemas with column types, primary keys, foreign keys, timestamps, and enums.
   - **TypeORM Entity Code (`.ts`)**: Direct AST/regex parsing of TypeORM classes and decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, `@OneToMany`, `@ManyToMany`).
   - **OpenAPI 3.0 / 3.1 Spec (JSON / YAML)**: Parse `components.schemas` and `paths` into entities, fields, and custom endpoints.
2. **Purity of Engine Core:**
   All parsers and transformation logic live in `src/core/import/` with zero DOM/React dependencies.
3. **Valid by Construction:**
   The output of every import is a valid `Project` model that passes `validateProject(project)` with zero errors.
4. **Dual-Surface Availability:**
   - **CLI (`chz import`)**: Non-interactive command for automated CI/CD and developer terminal workflows.
   - **Studio UI (`ImportProjectDialog`)**: Accessible HeroUI v3 modal with syntax-aware paste/upload and instant entity/field preview.
5. **Zero Regression:**
   All existing 54 test suites (449+ tests) remain green.

---

## 2. Supported Formats & Feature Matrix

| Feature | SQL DDL | TypeORM TS AST | OpenAPI 3.x |
|---|---|---|---|
| **Entity Extraction** | `CREATE TABLE <table>` -> PascalCase Entity | `@Entity('table') class Entity` | `components.schemas[Name]` |
| **Field Types** | `VARCHAR`, `TEXT`, `INT`, `BIGINT`, `BOOLEAN`, `TIMESTAMP`, `UUID`, `JSON`, `DECIMAL` | `@Column({ type: '...' })` | `type: string, integer, boolean, object` |
| **Primary Keys** | `PRIMARY KEY`, `SERIAL`, `BIGSERIAL`, `AUTO_INCREMENT` | `@PrimaryGeneratedColumn`, `@PrimaryColumn` | Property with `format: uuid` or named `id` |
| **Enums** | `CREATE TYPE ... AS ENUM (...)` or inline enum | `@Column({ enum: [...] })` | Schema `enum: [...]` |
| **Relations** | `FOREIGN KEY (...) REFERENCES ...` | `@ManyToOne`, `@OneToMany`, `@ManyToMany` | Schema `$ref` references |
| **Special Features** | `created_at`, `updated_at`, `deleted_at` -> auto-flag timestamps/soft-delete | `@CreateDateColumn`, `@DeleteDateColumn` | `readOnly: true`, `format: date-time` |
| **Custom Endpoints** | — | — | `paths[route][method]` -> `customEndpoints` |

---

## 3. Implementation Plan

### Phase 1 — Core Importer Library (`src/core/import/`)
- [ ] `src/core/import/naming.ts`:
  - `toEntityName(table: string): string` (plural to singular PascalCase, e.g. `blog_posts` -> `BlogPost`).
  - `toFieldName(column: string): string` (snake_case to camelCase, e.g. `published_at` -> `publishedAt`).
  - `toEnumName(name: string): string` (PascalCase enum name).
- [ ] `src/core/import/sql-ddl.ts`:
  - SQL statement tokenizer and DDL extractor.
  - Table name, column name, data type mapper, constraints (PK, nullable, unique, default).
  - Foreign key relationship resolver (maps to `RelationDef`).
  - Detects timestamp fields (`createdAt`, `updatedAt`) and soft-delete (`deletedAt`).
- [ ] `src/core/import/typeorm-ast.ts`:
  - Parse TypeORM decorator annotations: `@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, `@OneToMany`, `@ManyToMany`.
  - Extract entity options, field definitions, relation directions, and enums.
- [ ] `src/core/import/openapi.ts`:
  - Extract entity models from OpenAPI schemas.
  - Map endpoints from `paths` into custom endpoints.
- [ ] `src/core/import/index.ts`:
  - Unified `importProject({ format, content, projectName, driver })`.
  - Auto-detector determining format from file extension or content patterns.

### Phase 2 — Unit Test Coverage
- [ ] `src/core/import/sql-ddl.test.ts`:
  - Test PostgreSQL, MySQL, and SQLite DDL inputs.
  - Test FK resolution, compound primary keys, timestamp detection, and soft-delete.
- [ ] `src/core/import/typeorm-ast.test.ts`:
  - Test entity class parsing with relations, column types, and enums.
- [ ] `src/core/import/openapi.test.ts`:
  - Test OpenAPI 3.0 petstore/blog schemas and path endpoints.
- [ ] `src/core/import/index.test.ts`:
  - Test end-to-end import creating valid `Project` conforming to `validateProject()`.

### Phase 3 — Standalone CLI Integration (`chz import`)
- [ ] Update `src/core/cli/args.ts` to support `import` subcommand:
  - `chz import --sql <file> [--name <name>] [--out <file>]`
  - `chz import --typeorm <file> [--name <name>] [--out <file>]`
  - `chz import --openapi <file> [--name <name>] [--out <file>]`
  - Optional `--generate --out <dir>` for one-step import and project generation.
- [ ] Update `src/core/cli/actions.ts` to execute the import flow and output JSON or generate API.
- [ ] Update CLI test suite.

### Phase 4 — Studio UI Integration (`ImportProjectDialog`)
- [ ] Create `src/features/projects/ImportProjectDialog.tsx`:
  - HeroUI v3 compound dialog (`Modal`, `Tabs`, `Button`, `Input`, `Textarea`, `Badge`).
  - Format selection tabs: **SQL DDL**, **TypeORM Entities**, **OpenAPI**.
  - Direct file upload or code pasting.
  - Live preview summary: detected Entities, Fields, Relations, and Enums.
  - Action button: "Import & Open Project" (saves to local projects store and opens directly in the designer).
- [ ] Add "Import schema" button on `ProjectsScreen.tsx`.
- [ ] Add unit tests for `ImportProjectDialog`.

### Phase 5 — Full Project Verification
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`

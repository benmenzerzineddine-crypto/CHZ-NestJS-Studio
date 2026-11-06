# chz-nest — Low-code NestJS + TypeORM API generator

Desktop studio (Tauri 2 + React 19) for designing a data model and exporting a
runnable NestJS REST API with TypeORM, JWT authentication and role/ownership
authorization.

- **Last updated:** 2026-11-04
- **Status:** M0–M4, M5a (Docker verification), M5b (Standalone CLI), and M5c (Password reset & email verification) done. Automated tests (34 files / 306 tests) and build are green. The studio publishes an unformatted preview in <300ms and formats in the background.
- **Repo state:** studio shell + model designer + auth configuration + generator,
  preview, ZIP export and manifest-based disk export implemented with three-way
  conflict classification and generated auth/authorization hardening. List
  queries emit typed filters/ranges, whitelisted sorting, pagination metadata and
  contains search; soft delete/restore, deterministic seeds, Swagger schemas,
  Docker, and per-entity e2e specs are implemented.

---

## 1. Locked decisions

| Area | Decision | Notes |
| --- | --- | --- |
| ORM | **TypeORM** | No adapter abstraction in v1; keep emitters isolated so Drizzle/Prisma can be added later |
| Generation target | **Whole new project** | Complete runnable scaffold, no injection into existing apps until M5 |
| Model editing UX | **Form-based** | Entity list + field table + relation picker; no drag-and-drop canvas in v1 |
| Export | **Disk + ZIP** | Folder picker writes directly; ZIP as a secondary path |
| Database | **PostgreSQL 16 default**, MySQL/SQLite selectable | Driver-aware column mapping from day one |
| Auth | **JWT access + rotating refresh tokens** | `bcrypt` cost 12, argon2id as a later option |
| Authorization | **Roles + ownership per operation** | Per-entity access matrix, enforced in generated guards/services |
| Package manager | **npm** | Generated project uses npm scripts |
| UI language | English | |
| Testing | `Vitest` unit tests + full-tree snapshots + golden-output build check | |

---

## 2. Product overview

The app is a desktop low-code studio with these screens:

1. **Projects** — create/open/recent/delete projects, autosaved locally.
2. **Settings** — project name, package name, DB driver, API prefix, feature flags.
3. **Entities** — form-based data model editor (fields, enums, relations).
4. **Auth** — auth switches, token TTLs, roles, seed admin, access matrix.
5. **Endpoints** — read-only review of the routes that will be generated.
6. **Generate** — validation results, generated file tree, Monaco preview,
   **Export ZIP** and **Write to folder**.

Every project is stored as a single JSON document in the Tauri app-data directory.
Generating is deterministic: same model + same generator version = same file tree.

---

## 3. Architecture

```
src/
  app/                      # shell, navigation, theme
  components/ui/            # shadcn-style primitives (Tailwind 4)
  features/
    projects/               # project list, create dialog
    settings/               # project settings form
    designer/               # entities, fields, enums, relations
    auth/                   # auth config + access matrix
    endpoints/               # generated route review
    preview/                # file tree + Monaco viewer
  core/                     # framework-agnostic, no React imports
    model/
      schema.ts             # Zod schemas (Project, Entity, Field, Relation, ...)
      defaults.ts           # factories for new projects/entities/fields
    validate/               # semantic validation (names, refs, roles, owner)
    ir/                     # normalized model + naming + import registry
    emit/                   # one emitter per artifact
    format/                 # Prettier standalone (TS/JSON)
    export/                 # manifest hashing, ZIP, diff plan
    fixtures/               # blog.json used by tests
  store/                    # Zustand slices + zundo undo/redo + autosave
src-tauri/
  src/lib.rs                # plugin + command registration
  src/commands/projects.rs  # app-data persistence
  src/commands/files.rs     # manifest read, atomic write, reveal
```

**Rust is a thin I/O layer only.** All modeling, validation and code generation
live in TypeScript so they stay testable and portable (a future CLI can reuse
`src/core`).

### Tauri plugins / crates

- `tauri-plugin-dialog` — folder picker.
- `tauri-plugin-opener` — reveal generated folder (already installed).
- Custom commands instead of `tauri-plugin-fs` (avoids persisted-scope pain and
  lets us do atomic writes + overwrite decisions in one place).
- `sha2` + `serde` on the Rust side; hashing in TS uses Web Crypto.

---

## 4. Project model (Zod)

```ts
type Driver = 'postgres' | 'mysql' | 'sqlite';
type Operation = 'list' | 'read' | 'create' | 'update' | 'delete';
type AccessLevel = 'public' | 'authenticated' | 'roles' | 'owner';

interface AccessRule {
  level: AccessLevel;
  roles?: string[];       // required when level === 'roles'
}

interface AuthConfig {
  enabled: boolean;
  registerEnabled: boolean;
  refreshTokens: boolean;
  accessTokenTtl: string;     // '15m'
  refreshTokenTtl: string;    // '7d'
  passwordMinLength: number;
  seedAdmin: boolean;
  adminUserEndpoints: boolean;
  roles: { key: string; label: string }[]; // default: admin, user
}

interface Project {
  id: string;
  schemaVersion: 1;
  name: string;
  packageName: string;
  driver: Driver;
  auth: AuthConfig;
  enums: EnumDef[];
  entities: EntityDef[];
  settings: {
    packageManager: 'npm';
    apiPrefix: string;        // 'api'
    swagger: boolean;
    docker: boolean;
    tests: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface EntityDef {
  id: string;
  name: string;               // PascalCase singular, e.g. 'Post'
  description?: string;
  fields: FieldDef[];
  relations: RelationDef[];
  options: {
    timestamps: boolean;
    softDelete: boolean;
    pagination: boolean;
    searchFields: string[];
    sortFields: string[];
    owner: boolean;            // auto-managed by the access matrix
    ownerRelation?: string;    // property name of the managed relation to User
  };
  access: Record<Operation, AccessRule>;
}

type FieldType =
  | 'string' | 'text' | 'int' | 'float' | 'decimal'
  | 'boolean' | 'date' | 'datetime' | 'uuid' | 'json' | 'enum';

interface FieldDef {
  id: string;
  name: string;               // camelCase
  type: FieldType;
  required: boolean;
  unique: boolean;
  indexed: boolean;
  primary: boolean;           // implicit uuid PK if none marked
  defaultValue?: string;
  enumId?: string;
  column?: { length?: number; precision?: number; scale?: number };
  validators?: { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string };
}

type RelationKind = 'many-to-one' | 'one-to-many' | 'one-to-one' | 'many-to-many';

interface RelationDef {
  id: string;
  name: string;               // property name on this entity
  targetEntityId: string;
  kind: RelationKind;
  nullable: boolean;
  cascade: boolean;
  // inverse side is derived, never edited directly
}
```

### Access defaults for a new entity

| Operation | Default |
| --- | --- |
| `list` | `authenticated` |
| `read` | `authenticated` |
| `create` | `authenticated` |
| `update` | `owner` |
| `delete` | `roles: ['admin']` |

If auth is disabled, all rules are ignored at generation time.

---

## 5. Generated project

```
<project>/
  src/
    main.ts                       # ValidationPipe, /api prefix, Swagger bearer
    app.module.ts                 # ConfigModule + TypeOrmModule.forRootAsync + APP_GUARD
    app.controller.ts             # GET /api/health  (@Public)
    config/
      typeorm.config.ts
      swagger.config.ts
    database/
      data-source.ts              # CLI DataSource for migrations
      run-migrations.ts           # Docker entrypoint migration runner
      migrations/
      seeds/seed.ts               # admin + deterministic sample data
    common/
      dto/pagination-query.dto.ts
      filters/all-exceptions.filter.ts
      interceptors/transform.interceptor.ts
      access/access-context.ts    # applyAccessScope helper
    auth/
      auth.module.ts  auth.controller.ts  auth.service.ts
      dto/{register,login,refresh-token}.dto.ts
      strategies/jwt.strategy.ts
      guards/{jwt-auth.guard,roles.guard}.ts
      decorators/{public,roles,current-user}.decorators.ts
      interfaces/jwt-payload.interface.ts
    users/
      users.module.ts  users.service.ts  users.controller.ts   # admin-only
      entities/{user.entity,refresh-token.entity}.ts
      dto/{create-user,update-user,update-roles,change-password}.dto.ts
    modules/<entity>/
      <entity>.module.ts          # TypeOrmModule.forFeature([Entity])
      <entity>.entity.ts
      <entity>.controller.ts
      <entity>.service.ts
      dto/{create,update,query,paginated}-<entity>.dto.ts
  test/<entity>.e2e-spec.ts       # optional per-entity CRUD (settings.tests)
  test/utils/{auth,db,factories}.ts
  package.json  tsconfig.json  nest-cli.json
  .env.example  .eslintrc.js  .prettierrc
  docker-compose.yml  Dockerfile  docker-entrypoint.sh  .dockerignore  README.md
  chz-nest.json                   # generator manifest
```

Generated endpoints per entity:

```
GET    /api/<plural>        list    (pagination, filters, sort, search)
GET    /api/<plural>/:id    read
POST   /api/<plural>        create
PATCH  /api/<plural>/:id    update
DELETE /api/<plural>/:id    delete   (soft delete when enabled)
POST   /api/<plural>/:id/restore     (soft delete only)
```

List queries accept `page`, `limit`, `search`, `sort`, `order` and per-field
filters. `search` ORs across the entity's configured `searchFields`; when none
are selected it falls back to every `string`/`text` field so every entity with
text data has working search. String filters are contains matches; all other
filter types use equality.

`User` and `RefreshToken` are reserved entities: they cannot be created, renamed
or deleted, but `User` may receive extra fields via the Users entity edit screen.

---

## 6. Auth & authorization in the generated app

**Authentication**

- `POST /api/auth/register` (toggleable), `POST /api/auth/login`,
  `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.
- JWT access token (short TTL) + rotating refresh token stored **hashed**
  (`sha256`) in `refresh_tokens` with `expiresAt` / `revokedAt`.
- Passwords hashed with `bcrypt` cost 12; `passwordHash` is `select: false` and
  `@Exclude()` so it can never leak through serialization.
- `@nestjs/throttler`: 5 req/min on login/register.
- Seed admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when `SEED_ADMIN=true`.
- `main.ts` refuses to start in production if JWT secrets still hold defaults.

**Authorization**

- Global `JwtAuthGuard` (`APP_GUARD`) + `RolesGuard`; `@Public()` on auth and
  health routes.
- `@Roles(...)` emitted from the access matrix.
- **Ownership is enforced in the service**, not a guard (no extra fetch):
  `applyAccessScope(qb, user)` restricts `list/read/update/delete` to
  `ownerId = user.id` unless the caller holds an admin role.
- Admin-only user endpoints: `GET /api/users`, `PATCH /api/users/:id/roles`,
  `DELETE /api/users/:id`. Roles never appear in the generic update DTO.

**Access matrix → generated code**

| Rule | Emitted on controller method |
| --- | --- |
| `public` | `@Public()` |
| `authenticated` | nothing (global guard) |
| `roles: [...]` | `@Roles('admin', 'editor')` |
| `owner` | `@Roles('admin')` bypass note + service scoping |

---

## 7. Generator pipeline

```
Project (Zod) ─► validate() ─► buildIR() ─► emit*() ─► format() ─► FileTree
                                   │
                                   ├─ naming: Pascal / camel / kebab / plural
                                   ├─ import registry (no missing/unused imports)
                                   └─ driver-aware type mapping
```

- Emitters are **pure functions** `(ir) => GeneratedFile[]`; no React, no I/O.
- The import registry collects decorator/module imports as code is emitted, so
  imports cannot drift from usage.
- Prettier standalone formats `.ts` / `.json`; `.env`, README and Prisma-free
  configs pass through untouched.
- Snapshot tests cover the whole tree for the `blog.json` fixture; unit tests
  cover naming, type mapping per driver, validator emission and access rules.
- A **golden-output check** (`scripts/verify-output.mjs`) writes the fixture to a
  temp dir, runs `npm install`, `npm run build`, and boots with SQLite to verify
  `GET /api/health`. Postgres/MySQL variants build without booting unless
  `--boot` and database credentials are provided. Network-dependent, so run
  manually / in CI, not on every unit run.
- The same pipeline is exposed as a Node CLI (`npm run chz -- generate
  model.json`), so CI can regenerate without the desktop app; it reuses the
  export plan and `chz-nest.json` manifest policy below.

### Type mapping (PostgreSQL)

| Model | TS | TypeORM | Validator |
| --- | --- | --- | --- |
| string | string | `varchar(255)` | `@IsString @MaxLength` |
| text | string | `text` | `@IsString` |
| int | number | `int` | `@IsInt` |
| float | number | `double precision` | `@IsNumber` |
| decimal | string | `numeric(p,s)` | `@IsNumberString` |
| boolean | boolean | `boolean` | `@IsBoolean` |
| date | string | `date` | `@IsDateString` |
| datetime | Date | `timestamptz` | `@IsDateString` |
| uuid | string | `uuid` / PK | `@IsUUID` |
| json | object | `jsonb` | `@IsObject` |
| enum | TS enum | PG enum | `@IsEnum` |

Driver overrides: SQLite (`simple-json`, `datetime`, no native enum → `varchar`),
MySQL (`json`, `datetime(6)`, enum → `varchar`).

---

## 8. Export & overwrite policy

Export writes a `chz-nest.json` manifest:

```json
{
  "generatorVersion": "0.1.0",
  "projectId": "prj_...",
  "modelHash": "sha256",
  "createdAt": "...",
  "files": { "src/main.ts": "sha256", "package.json": "sha256" }
}
```

Re-export flow:

1. `read_manifest(root, paths)` returns the stored manifest plus hashes for paths
   listed in the manifest and the supplied generated paths, so files outside the
   manifest can be detected without scanning the folder.
2. Frontend classifies each generated file with a three-way comparison of the
   generated hash, the manifest hash and the disk hash: **new**, **untracked**,
   **unchanged**, **generator-updated**, **disk-modified**, or
   **missing-from-disk**.
3. New, missing and generator-updated files are written automatically. Unchanged
   files are skipped. Disk-modified and untracked files prompt per file/bulk:
   **overwrite / skip / write as `<file>.new`**.
4. A skipped disk-modified file keeps its previous manifest hash, so it remains a
   conflict on the next export. A skipped or `.new` untracked file is omitted
   from the manifest.
5. Files not in the manifest are never deleted.
6. Writes are atomic (unique temp file + rename without deleting the destination
   first) and report a per-file result. Parent directories are only created after
   the nearest existing ancestor is verified to be inside the selected folder.

---

## 9. Build steps

Work through these in order. Each step has its own file with tasks and acceptance criteria.

| Step | Plan file | Scope | Outcome |
| --- | --- | --- | --- |
| **M0** | [`plans/01-foundation.md`](plans/01-foundation.md) | Shell, model schema, store, Tauri I/O, projects screen | Create/save/reopen a project |
| **M1** | [`plans/02-model-designer.md`](plans/02-model-designer.md) | Entity/field/enum/relation editors, validation, auth matrix | Blog model with roles validates |
| **M2** | [`plans/03-generator-core.md`](plans/03-generator-core.md) | IR, emitters, auth code, preview, ZIP, snapshots | Generated app builds, login works |
| **M3** | [`plans/04-authorization-and-export.md`](plans/04-authorization-and-export.md) | Roles/ownership enforcement, disk export, manifest diff | 401/403/owner e2e pass; re-export prompts |
| **M4** | [`plans/05-depth.md`](plans/05-depth.md) | Filters/sort, soft delete, seed, Swagger, Docker, per-entity e2e | Generated project's own suite passes |
| **M5** | [`plans/06-later.md`](plans/06-later.md) | Password reset, custom endpoints, CASL, import, CLI | Not part of v1 |
| **M5a** | [`plans/07-docker-verification.md`](plans/07-docker-verification.md) | One-command Docker smoke test after generation | Stack health, login and seeds verified |
| **M5b** | [`plans/08-standalone-cli.md`](plans/08-standalone-cli.md) | `chz` CLI over a project JSON, same pipeline and export policy | Generate from CI without the desktop app |
| **M5c** | [`plans/09-password-reset-and-email-verification.md`](plans/09-password-reset-and-email-verification.md) | Password reset & email verification with single-use hashed tokens and mail service | Endpoints, security invariants, and e2e tests |
| **M5d** | [`plans/10-custom-endpoints.md`](plans/10-custom-endpoints.md) | Custom entity endpoints with HTTP methods, paths, and access matrix rules | Controller routes, service stubs, and UI editor |
| **M5n** | [`plans/20-schema-and-db-import.md`](plans/20-schema-and-db-import.md) | Reverse engineering & schema import (SQL DDL, TypeORM AST, OpenAPI) | Single-click project creation from existing schemas |
| **M5o** | [`plans/21-background-jobs-bullmq.md`](plans/21-background-jobs-bullmq.md) | Background jobs & worker queues (BullMQ / Redis) | Typed producers, processors, Redis docker service, studio editor |
| **M5p** | [`plans/22-realtime-websockets.md`](plans/22-realtime-websockets.md) | Real-time WebSockets & event broadcasting (Socket.IO) | Socket.IO gateway, JWT handshake auth, CRUD broadcasting, room scoping |

**Rule:** do not start a step before the previous step's acceptance criteria are met.
Each plan file is self-contained: goal, dependencies, tasks, files touched,
verification, and risks.

---

## 10. Testing strategy

| Layer | Tool | What |
| --- | --- | --- |
| Schema / validation | Vitest | Zod factories, naming, reserved names, relation integrity, role refs |
| Generator | Vitest + snapshots | Full file tree for `blog.json`, per-driver variants, access decorators |
| Golden output | Node script | install + build + boot generated app (manual/CI) |
| Docker output | Node script | one-command compose build, health, login and seed smoke test (manual/CI) |
| Generated API | Jest + Supertest (in generated project) | auth 401/refresh, 403 roles, owner scoping, CRUD happy paths |
| Studio UI | Vitest + Testing Library | store actions and validation panel only; no heavy component tests |
| CLI | Vitest (node env) | argument parsing, path guards, conflict policy, CLI/studio output parity |

---

## 11. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Driver quirks (json/numeric/timestamps/enums) | Central mapping table + per-driver snapshot tests; Postgres is the golden path |
| Import/decorator drift in generated code | Import registry + `tsc` build in golden check |
| Privilege escalation via generic user CRUD | Separate users module, no roles/password fields in generic DTOs |
| Owner data leakage | One `applyAccessScope` helper used by every query + e2e tests |
| Regenerating edited files | Manifest + hash diff + explicit overwrite prompt, never delete |
| Tauri fs permissions | Custom Rust commands, no fs plugin scope |
| Monaco bundle size | Lazy-load the Preview screen |
| Scope creep in the editor | Form editor only in v1; canvas and imports deferred to M5 |

---

## 12. Deferred (explicitly out of v1)

- TypeORM injection into existing projects / AST merge.
- Drag-and-drop ERD canvas.
- Import from existing TypeORM entities or live DB introspection.
- Password reset, email verification, 2FA, OAuth providers.
- CASL/policy-based authorization (RBAC + ownership only in v1).
- MySQL/SQLite hardening beyond mapping tests.
- Custom user templates / plugin API.

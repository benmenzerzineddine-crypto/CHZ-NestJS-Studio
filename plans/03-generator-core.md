# Step 03 — Generator core & auth code (M2)

**Goal:** convert a valid project into a complete, formatted, buildable NestJS +
TypeORM project (including auth), preview it in the app, and export it as a ZIP.

- **Depends on:** [`01-foundation.md`](01-foundation.md),
  [`02-model-designer.md`](02-model-designer.md)
- **Plan reference:** `plan.md` §5, §6, §7
- **Next step:** [`04-authorization-and-export.md`](04-authorization-and-export.md)

---

## Scope

**In:** IR + naming + import registry, driver type mapping, all emitters (scaffold,
database, entities/modules, users/auth), Prettier formatting, snapshot tests,
preview screen, ZIP export, golden build script.

**Out:** writing to disk, manifest diff/overwrite prompts, generated e2e suites,
filters/sort beyond pagination basics.

---

## Tasks

### 3.1 IR foundation

- [x] `src/core/ir/types.ts`: `ProjectIR`, `EntityIR`, `FieldIR`, `RelationIR`,
      `EnumIR`, `GeneratedFile { path, content, kind }`, `FileTree`.
- [x] `src/core/ir/naming.ts`: PascalCase/singular, camelCase, kebab-case, plural,
      REST path, DTO names, table names (`snake_case` plural). Collision detection
      (e.g. two entities that pluralize identically).
- [x] `src/core/ir/imports.ts`: import registry that dedupes and sorts imports per file.
- [x] `src/core/ir/build.ts`: normalize project → IR; derive inverse relations,
      owner relation, PK, timestamps, soft-delete columns, enum type names.
- [x] `src/core/ir/type-map.ts`: model type → TS type, TypeORM column options,
      validator decorators, per driver (`postgres`, `mysql`, `sqlite`).
- [x] Unit tests: naming edge cases (`Category` → `categories`), type map per
      driver, owner/PK derivation, collision errors.

**Files:** `src/core/ir/*`

### 3.2 Formatting + file tree

- [x] `src/core/format/format.ts`: Prettier standalone for `typescript` and `json`
      (`prettier/plugins/typescript`, `estree`, `babel` as needed); failures fall
      back to raw output and log a warning.
- [x] `src/core/ir/tree.ts`: flatten `FileTree`, sort deterministically, compute sizes.
- [x] Tests: formatting a malformed-but-parseable file still returns valid output.

**Files:** `src/core/format/*`

### 3.3 Project scaffold emitters

- [x] `emit/package.ts`: `package.json` — Nest 11 deps, TypeORM, `pg`/`mysql2`/`better-sqlite3`
      by driver, `@nestjs/config`, `@nestjs/swagger`, `@nestjs/jwt`, `@nestjs/passport`,
      `@nestjs/throttler`, `class-validator`, `class-transformer`, `bcrypt`,
      `passport-jwt`; scripts: `start`, `start:dev`, `build`, `test`, `test:e2e`,
      `typeorm`, `seed`.
- [x] `emit/config-files.ts`: `tsconfig.json`, `nest-cli.json`, `.eslintrc.js`,
      `.prettierrc`, `.gitignore`.
- [x] `emit/env.ts`: `.env.example` with DB + JWT + admin seed variables.
- [x] `emit/docker.ts`: `Dockerfile` (multi-stage) + `docker-compose.yml`
      (Postgres service matching the driver).
- [x] `emit/readme.ts`: setup, migrations, auth flow, endpoint list.
- [x] `emit/main.ts`: global `ValidationPipe` (`whitelist`, `transform`),
      global prefix, `ClassSerializerInterceptor`, exception filter, Swagger with
      `addBearerAuth()`.
- [x] `emit/app-module.ts`: `ConfigModule.forRoot`, `TypeOrmModule.forRootAsync`,
      feature modules, `APP_GUARD`, `APP_INTERCEPTOR`, `APP_FILTER`, throttler.
- [x] `emit/health.ts`: `@Public()` health controller.

**Files:** `src/core/emit/*`

### 3.4 Database & common emitters

- [x] `emit/typeorm-config.ts`: driver-aware connection options from env,
      `synchronize` only outside production, entities auto-load via glob.
- [x] `emit/data-source.ts`: CLI `DataSource` for migrations (`src/database/data-source.ts`).
- [x] `emit/common.ts`: `PaginationQueryDto`, `PaginatedResponse` type,
      `AllExceptionsFilter`, `TransformInterceptor`.
- [x] `emit/access.ts`: `AccessContext` type, `applyAccessScope(qb, user, ownerColumn)`
      helper, `CurrentUser` decorator, `Public`, `Roles` decorators.
- [x] `emit/seed.ts` (only when `settings.tests` or `seedAdmin`): admin user.
      Deterministic sample rows are deferred until generated e2e fixtures land in
      M3/M4; the seed script and `seed` package script are omitted when both
      settings are off.

**Files:** `src/core/emit/database.ts`, `common.ts`, `access.ts`, `seed.ts`

### 3.5 Entity & module emitters

- [x] `emit/entity.ts`: `@Entity(table)`; columns with driver-aware options;
      `@Index`, `unique`, defaults, enum column; PK (`@PrimaryGeneratedColumn('uuid')`
      or designated field); `@CreateDateColumn` / `@UpdateDateColumn` /
      `@DeleteDateColumn`; relations with `@ManyToOne` + `@JoinColumn`,
      `@OneToMany`, `@OneToOne`, `@ManyToMany` + `@JoinTable` (owning side only);
      owner relation; `passwordHash`-style exclusion not applicable to user entities only.
- [x] `emit/dto.ts`: `Create<Entity>Dto` (validators from type map, `@IsOptional`
      for non-required), `Update` via `PartialType(Create)`, `Query` extends
      pagination with filter fields (`@IsOptional`), enum imports; never expose
      relation objects, only foreign keys.
- [x] `emit/service.ts`: `Repository<Entity>` injection, `findAll` with
      pagination/sort/search + `applyAccessScope`, `findOne`, `create`, `update`,
      `remove` (+ soft delete), `NotFoundException`, admin bypass.
- [x] `emit/controller.ts`: routes from `plan.md` §5, `@ApiTags`, `@ApiBearerAuth`,
      access decorators from the access matrix, `ParseUUIDPipe` for ids,
      `@CurrentUser()` where ownership applies.
- [x] `emit/module.ts`: `TypeOrmModule.forFeature([Entity])`, wiring.
- [x] Unit tests + snapshot per emitter using the blog fixture.

**Files:** `src/core/emit/entity.ts`, `dto.ts`, `service.ts`, `controller.ts`,
`module.ts`

### 3.6 Auth emitters

- [x] `emit/users.ts`: `User` entity (`email` unique, `passwordHash` with
      `select: false`, `roles` simple-array/enum, `isActive`, timestamps,
      soft delete, extra user fields), `RefreshToken` entity (hashed token,
      `expiresAt`, `revokedAt`, `userId`), `UsersService` (create, findByEmail,
      validatePassword, updateRoles, changePassword, soft delete).
- [x] `emit/auth.ts`: `AuthModule` (JWT registerAsync, Passport, Throttler),
      `AuthService` (register/login/refresh/logout/me, bcrypt hash/compare,
      refresh rotation + revocation, reuse of revoked token rejected),
      `AuthController` with `@Public()` on register/login/refresh and
      `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.
- [x] `emit/strategies.ts`: `JwtStrategy` with payload `{ sub, email, roles }`,
      `JwtAuthGuard` (respects `@Public()`), `RolesGuard`.
- [x] `emit/users-controller.ts` (when `adminUserEndpoints`): admin-only list,
      role patch, delete; `change-password` for self; roles/password never in
      generic DTOs.
- [x] `main.ts` production guard: throw when secrets are still defaults.
- [x] Snapshot tests: auth files for enabled/disabled auth, admin endpoints on/off.

**Files:** `src/core/emit/users.ts`, `auth.ts`, `strategies.ts`

### 3.7 Generator test suite

- [x] `src/core/generate.ts` facade: `generateProject(project): GenerateResult`
      (`files`, `issues`, `stats`); refuses to emit when `validateProject` has errors.
- [x] Unit tests: naming, imports dedupe, type map × 3 drivers, PK/owner derivation,
      access decorator selection.
- [x] Snapshot tests: full tree for `blog.json` on Postgres and SQLite; auth
      disabled variant; admin endpoints off variant.
- [x] Guard test: invalid project returns issues and zero files.

**Files:** `src/core/generate.ts`, `src/core/**/*.test.ts`, `__snapshots__/*`

### 3.8 Preview screen

- [x] Generate flow: validate → block with issue list on errors → otherwise show
      file tree grouped by folder, file count, total size, generator version.
- [x] Monaco read-only viewer (lazy-loaded) with language detection by extension.
- [x] Copy file content, expand/collapse tree, persist selected file per project.
- [x] Regenerate button; stale indicator when the model changed since last run.
- [x] Error state if formatting or emission throws (with file path context).

**Files:** `src/features/preview/*`, `src/store/generate.store.ts`

### 3.9 ZIP export

- [x] `src/core/export/zip.ts` using `fflate`; include `chz-nest.json` manifest
      (hashes via Web Crypto) with generator version + model hash.
- [x] Download with `<project>-<date>.zip`; disabled until a successful generation.

**Files:** `src/core/export/zip.ts`, `src/core/export/manifest.ts`

### 3.10 Golden output verification

- [x] `scripts/verify-output.mjs --fixture blog --driver sqlite`:
      build fixture via `generateProject`, write to a temp dir, `npm install`,
      `npm run build`, boot, hit `GET /api/health`, print generated tree summary.
- [x] `scripts/verify-output.mjs --driver postgres` variant for CI with a service
      container.
- [x] Document the command in `README.md` and `plan.md` references.

---

## Definition of done

1. `generateProject(blogFixture)` produces the full tree from `plan.md` §5.
2. Generated Postgres and SQLite projects pass `npm install && npm run build`.
3. Generated app boots and `GET /api/health` returns 200.
4. Register → login → `/auth/me` works with auth enabled.
5. A protected entity route returns 401 without a token.
6. Preview shows every file and ZIP download matches the preview.
7. Snapshot + unit tests green; invalid models never emit files.

---

## Verification

```bash
npm test
npm run build
node scripts/verify-output.mjs --fixture blog --driver sqlite
```

Manual: generate → export ZIP → unzip in `/tmp` → `npm i` → `npm run start:dev`
→ curl register/login/me.

---

## Notes / risks

- Generated `package.json` declares `allowScripts` for `bcrypt` (and
  `better-sqlite3` on SQLite) so npm 12+ runs the required native install
  scripts. Unrelated scripts such as `@scarf/scarf` stay blocked.
- `APP_INTERCEPTOR` (`ClassSerializerInterceptor`) and `APP_FILTER`
  (`AllExceptionsFilter`) are wired in `AppModule`; `main.ts` only installs the
  global prefix, validation pipe and Swagger.
- Golden verification passed for generated SQLite (install/build/boot/health plus
  login, `/auth/me`, 401 and CRUD smoke checks), Postgres build and MySQL build.
  Postgres/MySQL boot checks need a live database and were not run locally.
- Emit in dependency order; imports are collected through the registry, not
  hand-written per emitter.
- `bcrypt` is native but has prebuilt binaries; if CI is slow, keep it as the
  documented default and add argon2 later (M5).
- Don't snapshot volatile values (dates, ids) — the generator must be deterministic.
- Enums on SQLite/MySQL become `varchar` + app-level validation; keep that in the
  type map, not in individual emitters.

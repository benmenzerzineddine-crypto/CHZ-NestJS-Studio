# Step 05 — Depth & hardening (M4)

**Goal:** take the generated API from "runnable" to "pleasant to adopt": real
querying, soft delete, seeds, Swagger, Docker, per-entity e2e, and studio polish.

- **Depends on:** [`04-authorization-and-export.md`](04-authorization-and-export.md)
- **Plan reference:** `plan.md` §5, §6, §10
- **Next step:** [`06-later.md`](06-later.md)

---

## Scope

**In:** filters/search/sort, soft delete + restore, seed data, Swagger schemas,
Docker verification, per-entity e2e specs, generated README depth, studio UX polish.

**Out:** new auth mechanisms, custom endpoints, imports, alternative ORMs.

---

## Tasks

### 5.1 Querying: filters, search, sort

- [x] `Query<Entity>Dto` per entity from `options.searchFields`/`sortFields`:
      - strings → `@IsOptional() @IsString()` + `contains` filter
      - numbers/dates → `gte`/`lte` pairs
      - booleans/enums/uuid → exact match
- [x] `findAll` builds a `QueryBuilder` with:
      - `page` (default 1), `limit` (default 20, max 100)
      - `sort` restricted to the whitelist (`-createdAt` syntax)
      - `search` OR-ed across configured text fields, falling back to every
        string/text field when none are selected
      - explicit column selection excluding `passwordHash`-style fields
- [x] Response shape: `{ data, meta: { page, limit, total, totalPages } }` via
      `PaginatedResponse`; consistent across entities.
- [x] e2e: pagination bounds, invalid sort rejected, filters compose with owner scope.
- [x] Tests for the generated SQL/query builder options where practical.

**Files:** `src/core/emit/dto.ts`, `src/core/emit/service.ts`,
`src/core/emit/tests.ts`

### 5.2 Soft delete & restore

- [x] `@DeleteDateColumn` when `options.softDelete`; delete → `softRemove`.
- [x] `POST /api/<plural>/:id/restore` (admin or owner) with access rule
      `restore` derived from `delete`.
- [x] Default queries exclude soft-deleted rows; `?withDeleted=true` allowed for
      admins only, rejected for other callers.
- [x] e2e: deleted row disappears, restore brings it back, non-admin `withDeleted`
      is ignored/rejected, unique constraints after delete are documented.
- [x] Access matrix UI gains a read-only "restore" row (follows delete rule).

**Files:** `src/core/emit/entity.ts`, `service.ts`, `controller.ts`,
`src/features/auth/AccessMatrix.tsx`

### 5.3 Seeds

- [x] `src/database/seeds/seed.ts` runnable via `npm run seed`:
      - admin user from env when `seedAdmin`
      - 3 deterministic sample rows per entity (stable order, fixed ids where possible)
      - relations wired in dependency order, many-to-many linked after both sides exist
- [x] Seed respects enums and required fields; fails with a clear message on invalid config.
- [x] Optional `--reset` flag that truncates tables (dev only, guarded by `NODE_ENV !== 'production'`).
- [x] e2e or script assertion: seed runs twice without crashing (idempotent upsert).

**Files:** `src/core/emit/seed.ts`

### 5.4 Swagger

- [x] `@ApiProperty`/`@ApiPropertyOptional` on every DTO field (type, enum, format,
      example derived from field name/type).
- [x] `@ApiTags` per controller, `@ApiBearerAuth()` on protected routes,
      `@ApiOperation` summaries, `@ApiResponse` for 200/201/400/401/403/404.
- [x] Paginated envelope schema (`Paginated<Entity>Dto`) so docs are accurate.
- [x] `/api/docs` mounts only when `settings.swagger`; JSON at `/api/docs-json`.
- [x] Manual check: docs load, "Authorize" with a login token works end-to-end.

**Files:** `src/core/emit/dto.ts`, `controller.ts`, `main.ts`, `swagger.config.ts`

### 5.5 Docker

- [x] Multi-stage `Dockerfile` (deps → build → runtime, non-root user, `node:22-alpine`).
- [x] `.dockerignore`; migrations run on start via an entrypoint script (opt-in flag).
- [x] `docker-compose.yml`: app + db + healthcheck, `depends_on: condition: service_healthy`,
      env from `.env`, volume for Postgres.
- [x] Verify `docker compose up --build` → health endpoint reachable → login works.
- [x] Generated README documents local (npm) and Docker flows.

**Files:** `src/core/emit/docker.ts`, `readme.ts`

### 5.6 Per-entity e2e specs

- [x] `test/<entity>.e2e-spec.ts`: create → list → get → update → delete (+restore),
      including one validation failure (400) and one not-found (404).
- [x] Auth-aware: uses a seeded admin token and a normal-user token; owner-scoped
      entities assert isolation.
- [x] Shared test helpers (`test/utils/auth.ts`, `test/utils/db.ts`) emitted once.
- [x] `npm run test:e2e` runs all specs green on SQLite and Postgres.

**Files:** `src/core/emit/tests.ts`

### 5.7 Studio polish

- [x] Toast system for save/export/generation results; errors include a copyable detail.
- [x] Unsaved-changes guard on window close and project switch.
- [x] Validation badge in the header (0 errors / N warnings), click opens the panel.
- [x] Keyboard: `Ctrl/Cmd+S` save, `Ctrl/Cmd+Z/Y` history, `Ctrl/Cmd+Enter` generate,
      arrow navigation in the entity list.
- [x] Empty states with next actions on every screen.
- [x] Window min size, remembered window bounds, product name/icon.
- [x] Lazy-load Monaco and the Generate screen; memoize IR generation per model hash.
- [x] Accessibility pass: focus rings, labels, Escape closes dialogs.

**Files:** `src/app/*`, `src/features/**`, `src-tauri/tauri.conf.json`

### 5.8 Verification

- [x] Fresh project → build model → generate → export → `docker compose up --build`
      → docs + auth + CRUD + e2e all pass.
- [x] Studio e2e-free manual pass on the checklist above.

#### Desktop acceptance checklist

Run the app against isolated data and export into the workspace:

```bash
XDG_DATA_HOME="$PWD/.tmp/m4-acceptance" GDK_BACKEND=x11 npm run tauri dev
```

Create a temporary project, export to `$PWD/.tmp/m4-export`, then remove both
temporary folders only after the pass.

| Area | Check |
| --- | --- |
| Projects | Create, open, close and reopen a project; autosave reports saved; undo/redo works |
| Settings | Edit name, package, driver, API prefix and feature flags; changes persist |
| Entities | Add/edit/delete entity, field, enum and relation; validation badge updates and opens the panel |
| Auth | Add a role, change an access rule, confirm the ownership prompt, and see the read-only Restore row for soft delete |
| Endpoints | Routes include list/read/create/update/delete and restore where enabled |
| Generate | Fast preview appears, formatting completes, ZIP downloads, folder export writes the expected files |
| Keyboard | `Ctrl/Cmd+S`, `Ctrl/Cmd+Z/Y`, `Ctrl/Cmd+Enter`, and entity-list arrow navigation |
| Dialogs | Escape closes every dialog and focus rings are visible |
| Window | Minimum size holds; bounds are remembered after relaunch |
| Toasts | Copy-detail action copies the error detail |
| Cleanup | No generated output or temporary app data remains in the workspace |

---

## Definition of done

1. Generated API supports pagination, filters, search, sort, soft delete + restore.
2. Swagger documents every route and works with a bearer token.
3. Seeds run twice safely and produce a usable dataset.
4. Docker compose brings up app + database and the API responds.
5. Every entity has a green e2e spec.
6. Studio has no dead-end screens, and generation is visibly fast (<300ms for 10 entities).

---

## Notes / risks

- Keep the query DTO generator driven by the type map; do not hand-write per-entity code.
- `withDeleted` must not become a data-leak vector — enforce roles in the service.
- Docker adds CI time; run the compose check in a separate job, not on every commit.
- Swagger examples must not include real secrets or hashed passwords.

## Verification log — 2026-11-01

- Baseline re-check before the manual pass: `npm test` (28 files / 259 tests),
  `npm run build`, `cargo check`, and `cargo test` (14 tests) all green.
- Studio: `npm test` — 28 files / 259 tests; `npm run build` green.
- Generated SQLite (`blog` fixture): `tsc --noEmit`, full seed twice + `--reset`, and 69 e2e tests green.
- Generated Postgres: 69 e2e tests green against `postgres:16-alpine`.
- Auth-disabled generated project: 31 e2e tests green on SQLite.
- Docker (SQLite): `docker compose up --build` → healthy container, `GET /api/health`
  200, seeded admin login 200, `GET /api/posts` 200 with 3 sample rows.
- Docker (Postgres): compose brought up app + `postgres:16-alpine`, both healthy,
  health 200, seeded admin login 200, `GET /api/posts` 200 with 3 sample rows.
- Swagger: `/api/docs-json` exposes every generated route, `Paginated<Entity>Dto`,
  bearer security, and works with a login token.
- Performance: raw generation (no Prettier) is **47ms for 10 entities / 147 files**
  and **92ms for the 84-file blog fixture**. The studio publishes that fast preview
  immediately, then formats in the background (~1.7s for 10 entities) and disables
  export until formatting finishes. The `<300ms` visible-generation target is met.
- Desktop launch smoke: the Tauri window opened under XWayland and rendered the
  project shell, entity editor, Generate screen, header validation badge and an
  isolated export dialog (58 files written, 0 skipped). The full manual checklist
  (all screens, keyboard/focus behavior, remembered window bounds) remains
  pending because scripted GUI input was not reliable enough to complete it
  safely.
- Manual desktop pass: accepted by the user on 2026-11-01.
- M4 is complete.

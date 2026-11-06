# Step 04 — Authorization enforcement & disk export (M3)

**Goal:** make the generated authorization real and testable (roles, ownership,
admin-only users), then add the production export path: write the generated tree
into a chosen folder with manifest-based conflict handling.

- **Depends on:** [`03-generator-core.md`](03-generator-core.md)
- **Plan reference:** `plan.md` §6, §8
- **Next step:** [`05-depth.md`](05-depth.md)

---

## Scope

**In:** access-rule emission hardening, ownership scoping, users/admin endpoints,
generated e2e tests for 401/403/owner, folder export, manifest diff, overwrite
dialog, reveal in file manager, recent export path.

**Out:** new model features, filters/sort beyond current pagination, seeds,
Docker verification.

---

## Tasks

### 4.1 Access rule → code (hardening)

- [x] Verify each access level emits exactly the intended decorators:
      - `public` → `@Public()`, no bearer requirement in Swagger.
      - `authenticated` → nothing (global `JwtAuthGuard`), `@ApiBearerAuth()`.
      - `roles` → `@Roles(...)` after `@ApiBearerAuth()`.
      - `owner` → `@Roles(adminRole)`-based bypass documented + service scoping.
- [x] Guard order: `JwtAuthGuard` before `RolesGuard`; unauthenticated requests
      must get **401** (not 403) even on role-protected routes.
- [x] `@Public()` works on controller-level and method-level; auth routes stay public.
- [x] Generation test matrix: 5 operations × 4 levels × auth on/off → snapshot
      assertions on emitted decorators.

**Files:** `src/core/emit/controller.ts`, `src/core/emit/access.ts`,
`src/core/emit/auth.ts`

### 4.2 Ownership enforcement

- [x] Owner relation generated as `@ManyToOne(() => User, { onDelete: 'CASCADE' })`
      + `@JoinColumn({ name: 'ownerId' })` + indexed `ownerId` column.
- [x] `create` sets `ownerId = currentUser.id` **after** authorization checks; a
      client-supplied `ownerId` is ignored (never in the create DTO).
- [x] `findAll`, `findOne`, `update`, `remove` all pass through
      `applyAccessScope(qb, user, 'ownerId')` when any operation uses `owner`.
- [x] Admin bypass: callers holding the admin role see all rows.
- [x] `update`/`remove` return **404** (not 403) when the row exists but is not
      owned, to avoid existence leaks.
- [x] Unit tests for the scoping helper; generated e2e covers the behaviour.

**Files:** `src/core/emit/service.ts`, `src/core/emit/entity.ts`,
`src/core/emit/access.ts`

### 4.3 Users & admin endpoints

- [x] Self-service: `GET /api/auth/me`, `PATCH /api/users/me` (profile fields only),
      `POST /api/users/change-password` (requires current password).
- [x] Admin (when enabled): `GET /api/users` (paginated, excludes `passwordHash`),
      `PATCH /api/users/:id/roles`, `DELETE /api/users/:id` (cannot delete self,
      cannot remove the last admin).
- [x] Roles and password fields are absent from generic update DTOs; test that
      attempting to send them is rejected by `whitelist: true` / ignored.
- [x] Optional: deactivated users (`isActive = false`) cannot log in or refresh.
- [x] Generated tests for escalation attempts: a normal user patching their own
      roles, and an admin removing the last admin.

**Files:** `src/core/emit/users.ts`, `src/core/emit/users-controller.ts`,
`src/core/emit/auth.ts`

### 4.4 Generated e2e suite (auth)

- [x] Emit `test/auth.e2e-spec.ts` when `settings.tests`:
      register → login → me → refresh → old refresh token rejected → logout
      revokes → expired/invalid token 401.
- [x] Emit `test/authorization.e2e-spec.ts` for every entity with non-public rules:
      anonymous 401, wrong role 403, owner can update own row, second user cannot
      read/update/delete the first user's row (404), admin bypass succeeds,
      public route accessible.
- [x] Test bootstrap: SQLite in-memory for speed when driver is sqlite; Postgres
      via `docker-compose up -d db` otherwise; `synchronize: true` in test env,
      no migrations needed.
- [x] `npm run test:e2e` documented and runnable from the generated project.

**Files:** `src/core/emit/tests.ts`

### 4.5 Export to disk — Rust side

- [x] `read_manifest(root, paths)` → `{ manifest | null, existing: [{ path, sha256, mtime }] }`
      covering manifest paths plus the supplied generated paths; never scans the
      whole drive.
- [x] `write_files(root, entries[{ path, content, strategy }])` where strategy is
      `overwrite | skip`; `.new` is computed by the frontend as a renamed path.
- [x] Atomic write (unique temp + rename without deleting the destination first),
      verify the nearest existing ancestor is inside the root before creating
      directories, path-traversal guard, reject symlinked escape, continue on
      per-file errors and return a
      `WriteReport { written, skipped, failed: [{path, error}] }`.
- [x] `reveal_path(path)` via `tauri-plugin-opener` (`revealItemInDir`) from the JS side.
- [x] Rust tests: traversal rejection, overwrite vs skip, atomicity on failure,
      requested-path hashing, and symlinked-parent rejection.

**Files:** `src-tauri/src/commands/files.rs`

### 4.6 Export to disk — TypeScript side

- [x] `src/core/export/plan.ts`: pure `buildExportPlan(files, manifest, diskState)`
      → per-file classification `new | untracked | unchanged | generator-updated |
      disk-modified | missing-from-disk`, with generator updates overwritten
      automatically and disk/untracked conflicts defaulting to skip.
- [x] Manifest overrides preserve the previous hash for skipped disk edits and
      omit untracked files that are not adopted.
- [x] Hash with Web Crypto (`sha256`), deterministic JSON manifest
      (`generatorVersion`, `projectId`, `modelHash`, `createdAt`, `files`).
- [x] Folder picker via `@tauri-apps/plugin-dialog`; remember last export path per
      project (persisted in project JSON).
- [x] Export screen: choose folder → inspect → conflict list with per-file and bulk
      actions (**Overwrite / Skip / Write as .new**) → write → summary with counts
      + "Open folder".
- [x] Never delete files absent from the manifest; refuse to export into a
      non-empty folder that has no manifest without an explicit confirmation.
- [x] Pure-function tests: every classification and bulk-action combination.

**Files:** `src/core/export/*`, `src/features/preview/ExportDialog.tsx`,
`src/lib/tauri.ts`

### 4.7 Studio tests & verification

- [x] Store test: last export path, model change → "stale export" badge.
- [ ] Manual matrix: fresh folder, re-export unchanged, edit one generated file,
      delete one generated file, add an unrelated file.

---

## Definition of done

1. Generated app's `npm run test:e2e` passes for auth + authorization (SQLite and Postgres).
2. 401 vs 403 semantics match the matrix; owner isolation proven by e2e.
3. No privilege-escalation path exists in generated user endpoints.
4. Disk export handles all four file classifications correctly and never deletes
   unknown files.
5. Re-exporting an untouched project writes nothing new except updated hashes.

---

## Verification

```bash
# studio
npm test
npm run build

# generated project (from a temp export)
npm install && npm run build
npm run test:e2e

# export behaviours
# 1. export to empty folder
# 2. re-export (all unchanged)
# 3. edit src/main.ts -> prompt appears
# 4. choose .new -> src/main.ts.new exists, original untouched
# 5. add notes.md manually -> still present after re-export
```

---

## Notes / risks

- 404-vs-403 for foreign rows is deliberate; document it in the generated README.
- The manifest must exclude itself when hashing; write it last.
- If the target folder is a git repo, check `.gitignore` exists but never modify it.
- Keep the diff logic pure so it can be reused by a future CLI.
- M3 verified on 2026-10-25: 215 studio tests, studio build, `cargo test`
  (11 tests), generated SQLite and Postgres e2e (38 tests each), and the SQLite
  golden-output install/build/boot/health check. The manual desktop export matrix
  is pending because this environment has no GUI.
- The owner FK uses the locked string-target `@ManyToOne('User', ...)` form with
  `import type`, and its column is `owner_id` to match snake_case DB conventions.
- Owner scoping is applied per operation, so a public list stays public even when
  update/delete are owner-only.

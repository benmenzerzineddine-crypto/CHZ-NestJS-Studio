# Step 06 — Later (M5 backlog)

Not part of v1. Pick items only after M4 is accepted. Each item gets its own
plan file when scheduled.

- **Depends on:** [`05-depth.md`](05-depth.md)

---

## Candidate features

### Auth extensions

- **Password reset**: `POST /auth/forgot-password` + `POST /auth/reset-password`
  with single-use hashed tokens and expiry; email transport abstraction
  (console transport by default).
- **Email verification**: `emailVerifiedAt`, verification tokens, guard option
  `requireVerifiedEmail`.
- **OAuth providers**: Google/GitHub strategies behind a project setting.
- **2FA (TOTP)** with recovery codes.
- **Argon2id** hashing option, configurable cost/parallelism.
- **Session management UI data**: list active refresh tokens, revoke by id,
  "logout everywhere".

### Authorization extensions

- **CASL policies**: generated ability factory from a policy matrix, replacing
  hand-rolled role checks for complex cases.
- **Field-level permissions**: hide/mask fields per role in serialization.
- **Multi-tenancy**: `tenantId` scoping helper for all queries.
- **Custom endpoints**: designer rows for method/path/handler stub/access rule,
  emitted into the owning controller with a TODO body.
- **Endpoint-level rate limits and cache hints** in the designer.

### Input sources

- **Import from existing TypeORM entities** (ts-morph AST parse) → project model.
- **Import from a live database** (introspection per driver) → model with relations.
- **OpenAPI import** for a first-cut model.
- **Model export/import** as JSON with schema migration between versions.

### Generator extensions

- **One-command Docker verification**: generate, build, boot and smoke-test the
  compose stack in a single script (scheduled as `07-docker-verification.md`).
- **Prisma / Drizzle adapter** behind the same IR (the reason emitters stay pure).
- **Custom templates**: user-provided `.hbs` overrides per file with a safe sandbox.
- **Diff preview** in the studio (before/after per file).
- **Incremental regeneration into an existing project** using AST merge.
- **Standalone CLI** (`npx chz-nest generate model.json`) reusing `src/core`.
- **MySQL/SQLite hardening**: full type matrix, docker services, e2e coverage.

### Platform & DX

- **File uploads**: generated `attachments` module with local/S3 driver toggle.
- **WebSockets / SSE** module generation.
- **Background jobs** (BullMQ) starters.
- **i18n** for validation messages and the studio UI.
- **Auto-update** for the desktop app (Tauri updater plugin).
- **Telemetry-free crash reports** (opt-in) and a diagnostics export.
- **Project templates gallery** (blog, e-commerce, SaaS starter).

---

## How to schedule

1. Pick one item and confirm it doesn't contradict the v1 invariants
   (deterministic output, pure emitters, no silent data changes on export).
2. Write `plans/07-<slug>.md` using the same shape: goal, scope, tasks, DoD,
   verification, risks.
3. Add a row to the table in `plan.md` §9.
4. Implement behind a settings flag where the generated output changes shape, so
   existing projects keep generating the same code.

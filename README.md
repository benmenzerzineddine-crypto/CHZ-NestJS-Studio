# chz-nest — NestJS + TypeORM API Studio

A desktop low-code studio and CLI tool for designing rich data models and exporting enterprise-grade **NestJS + TypeORM** REST and GraphQL APIs with JWT authentication, role/ownership authorization, multi-tenancy, and automated end-to-end test suites.

Built with **Tauri 2**, **React 19**, **HeroUI v3**, **Vite**, **TypeScript strict**, and **Tailwind CSS v4**.

---

## Highlights

- **Visual Data Model Designer**: Define entities, fields, enums, and complex relations (`1:1`, `1:N`, `N:M`) with automatic inverse derivation and referential integrity cascades.
- **Enterprise Identity & Auth**:
  - JWT access tokens + rotating refresh tokens with `bcrypt` (work factor 12).
  - Two-Factor Authentication (2FA / TOTP) with QR codes and emergency recovery codes.
  - OAuth 2.0 social login integration (Google, GitHub, Discord).
  - Cryptographically secure password reset and email verification workflows.
- **Granular Authorization & Ownership**:
  - Interactive **Access Matrix** governing permissions per entity and operation (`list`, `read`, `create`, `update`, `delete`, `restore`).
  - Row-level ownership isolation returning **404 Not Found** (never 403) to prevent resource existence leaks.
  - Immutable admin safeguards preventing the deletion or demotion of the final administrator.
- **REST & Code-First GraphQL**:
  - Full CRUD REST endpoints with typed query DTOs, contains filters, range queries, whitelisted sorting, and pagination envelopes.
  - Code-first GraphQL schema generation with queries, mutations, resolvers, and Apollo Driver.
- **Advanced Capabilities**:
  - **Custom Endpoints**: Visual route builder with custom HTTP methods, parameters, request/response DTOs, and route-level caching/throttling.
  - **File Uploads & Attachments**: Integrated attachment handling supporting both local disk storage and AWS S3-compatible cloud storage.
  - **Multi-Tenancy Scoping**: Out-of-the-box tenant isolation via request headers, subdomains, or route parameters.
  - **Rate Limiting & Cache Hints**: `@nestjs/throttler` sliding window limits and `@nestjs/cache-manager` with HTTP `Cache-Control` hints.
- **Studio Polish & Diff Engine**:
  - Real-time semantic model validation with clickable error badges.
  - Sub-300ms raw preview with background Prettier formatting and Monaco code viewer.
  - Monaco DiffEditor with three-way conflict merge detection (untracked, disk-modified, generator-updated) when exporting into existing folders.
  - ZIP export with SHA-256 hashed manifests or direct atomic folder writes.
- **Headless Standalone CLI**:
  - `npm run chz -- validate <project.json>` and `npm run chz -- generate <project.json>` for headless CI/CD automation.
- **Production-Ready Generated Output**:
  - Complete NestJS 10 + TypeORM scaffold with Swagger/OpenAPI docs (`/docs`).
  - Container-ready multi-stage `Dockerfile` and `docker-compose.yml`.
  - TypeORM migrations and deterministic database seeding (`--reset`).
  - Per-entity Jest + Supertest E2E integration test suites.

---

## Documentation

For a step-by-step walkthrough of creating data models, configuring authorization, using the CLI, and deploying generated applications, see the comprehensive user guide:

📖 **[How to Use chz-nest Guide](docs/HOW-TO-USE.md)**

---

## Architecture

```
src/
  app/            # App shell, navigation, theme (HeroUI v3 + Tailwind v4)
  components/ui/  # Reusable UI primitives backed by HeroUI v3
  core/           # Framework-agnostic pure TypeScript engine (zero DOM / React imports)
    model/        # Zod schemas, defaults, and relation normalizer
    validate/     # Semantic model validation (integrity, ownership, roles)
    ir/           # Intermediate representation, type maps, and import registry
    emit/         # Pure code emitters (entities, DTOs, services, controllers, auth, tests)
    format/       # Background Prettier standalone formatting
    export/       # Manifest hashing, diff planning, and ZIP packaging
    cli/          # Command-line runner logic and arguments parser
  features/       # Feature views: projects, settings, designer, auth, endpoints, preview
  lib/            # Tauri IPC bridge and project repository
  store/          # Zustand store slices with Zundo undo/redo and autosave
src-tauri/
  src/commands/   # Thin Rust I/O layer: app-data persistence, atomic disk writes
```

**Architectural Boundaries:**
- `src/core/` is **100% pure TypeScript**; it never imports React, Tauri, or browser DOM APIs.
- The Rust layer (`src-tauri/`) is strictly a **thin I/O bridge** for native dialogs and atomic disk writes.
- All generators are pure functions `(ir) => GeneratedFile[]` without side effects, randomness, or direct I/O.

---

## Status & Milestones

All core milestones and advanced capability extensions are implemented, with automated test suites passing 100%:

| Milestone | Scope | Status |
| --- | --- | --- |
| **M0** | Foundation (Tauri 2, Zustand, undo/redo, autosave, app-data persistence) | Completed |
| **M1** | Model Designer (Entities, fields, enums, relations, semantic validation) | Completed |
| **M2** | Generator Core (NestJS + TypeORM emitters, Monaco preview, ZIP export) | Completed |
| **M3** | Authorization & Disk Export (Access matrix, owner isolation, E2E tests, 3-way merge) | Completed |
| **M4** | Depth & Hardening (Pagination envelopes, soft delete, deterministic seeds, Docker) | Completed |
| **M5a** | One-Command Docker Verification (`--docker` / `--keep-stack`) | Completed |
| **M5b** | Standalone CLI (`npm run chz -- validate\|generate`) | Completed |
| **M5c** | Password Reset & Email Verification (Mailer, token hashing, security endpoints) | Completed |
| **M5d** | Custom Endpoints (Visual route builder, DTO generation, route guards) | Completed |
| **M5e** | File Uploads & Attachments (Attachment entity, local and S3 storage drivers) | Completed |
| **M5f** | Multi-Tenancy Scoping (Tenant entity, header/subdomain/param scoping) | Completed |
| **M5g** | Rate Limiting & Cache Hints (Throttling overrides, response cache hints) | Completed |
| **M5h** | UI Component Refactor (Card primitives, form rows, confirm delete dialogs) | Completed |
| **M5i** | Diff Preview (Monaco DiffEditor, tree diff indicators) | Completed |
| **M5j** | OAuth Providers (Passport strategies for Google, GitHub, Discord) | Completed |
| **M5k** | Two-Factor Authentication (2FA TOTP secrets, QR codes, recovery codes) | Completed |
| **M5l** | GraphQL Schema & Resolvers (Code-first GraphQL, ApolloDriver, auth integration) | Completed |
| **M5m** | HeroUI v3 UI Migration (@heroui/react, @heroui/styles, Tailwind v4 tokens) | Completed |

See [`plans/README.md`](plans/README.md) for detailed task breakdowns and verification criteria.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Desktop Studio (Tauri 2)
```bash
npm run tauri dev
```

### 3. Run Web Mode (Browser Fallback)
```bash
npm run dev
```

### 4. Run the Standalone CLI
```bash
# Validate a project model
npm run chz -- validate ./src/core/fixtures/blog.json

# Generate project directly to disk
npm run chz -- generate ./src/core/fixtures/blog.json --out ./generated-api
```

---

## Available Scripts

```bash
npm run dev                 # Vite development server (browser mode with localStorage)
npm run build               # TypeScript check + production bundle build
npm test                    # Run Vitest test suite
npm run test:watch          # Vitest interactive watcher
npm run typecheck           # Run tsc --noEmit
npm run tauri dev           # Launch Tauri desktop application
npm run chz -- <cmd>        # Run the standalone chz-nest CLI

# Verification and smoke test suites
npm run verify:output       # Generate SQLite blog fixture, build, boot, and health-check
npm run verify:docker       # Generate and verify SQLite stack inside Docker Compose
npm run verify:docker:postgres # Generate and verify PostgreSQL stack inside Docker Compose
npm run verify:docker:mysql    # Generate and verify MySQL stack inside Docker Compose

# Rust compile and unit tests
cd src-tauri && cargo check && cargo test
```

---

## Security Invariants

- Generated services enforce row-level ownership via `applyAccessScope`; unauthorized accesses return **404 Not Found** (never 403) to prevent existence leakage.
- Passwords are encrypted using `bcrypt` at cost factor 12. `passwordHash` is configured with `select: false` in TypeORM and `@Exclude()` on class-transformer DTOs.
- Refresh tokens are hashed using SHA-256 before storage and rotated on every exchange. Changing a password revokes all existing refresh tokens.
- Last-admin protection: The system refuses to delete or remove administrative roles from the sole remaining administrator.
- The generated bootloader refuses to start in production (`NODE_ENV=production`) if default JWT secrets are detected.
- File system exporter validates path containment to prevent path traversal (`..` attacks) or accidental overwriting of untracked files without confirmation.

---

## Contributing & Development

Refer to [`AGENTS.md`](AGENTS.md) and [`DESIGN.md`](DESIGN.md) for architectural guidelines, HeroUI v3 design system tokens, and agent skills.

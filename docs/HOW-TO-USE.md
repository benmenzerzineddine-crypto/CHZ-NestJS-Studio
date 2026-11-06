# How to Use chz-nest — Comprehensive Guide

`chz-nest` is a desktop low-code studio and CLI tool designed for architecting, validating, and generating enterprise-grade **NestJS + TypeORM** REST and GraphQL APIs.

This guide walks you through every feature of the studio, the standalone CLI, and how to develop and deploy the generated NestJS application.

---

## Table of Contents

1. [Prerequisites & Installation](#1-prerequisites--installation)
2. [Launching the Studio](#2-launching-the-studio)
3. [Studio Workflow Walkthrough](#3-studio-workflow-walkthrough)
   - [3.1 Creating and Managing Projects](#31-creating-and-managing-projects)
   - [3.2 Project & Engine Settings](#32-project--engine-settings)
   - [3.3 Entity Designer (Fields, Types, Enums & Relations)](#33-entity-designer-fields-types-enums--relations)
   - [3.4 Authentication, 2FA & OAuth Configuration](#34-authentication-2fa--oauth-configuration)
   - [3.5 Granular Authorization & Row-Level Ownership](#35-granular-authorization--row-level-ownership)
   - [3.6 Custom Endpoints & Business Logic](#36-custom-endpoints--business-logic)
   - [3.7 File Uploads & Storage Attachments](#37-file-uploads--storage-attachments)
   - [3.8 Multi-Tenancy Scoping](#38-multi-tenancy-scoping)
   - [3.9 Rate Limiting & Cache Hints](#39-rate-limiting--cache-hints)
   - [3.10 Code-First GraphQL Generation](#310-code-first-graphql-generation)
   - [3.11 Model Semantic Validation](#311-model-semantic-validation)
   - [3.12 Code Preview, Monaco Diff Viewer & Export](#312-code-preview-monaco-diff-viewer--export)
4. [Standalone CLI Usage](#4-standalone-cli-usage)
5. [Working with the Generated NestJS Application](#5-working-with-the-generated-nestjs-application)
   - [5.1 Project Layout](#51-project-layout)
   - [5.2 Environment Configuration](#52-environment-configuration)
   - [5.3 Database Setup, Migrations & Seeds](#53-database-setup-migrations--seeds)
   - [5.4 Running the Application](#54-running-the-application)
   - [5.5 Docker & Docker Compose Deployment](#55-docker--docker-compose-deployment)
   - [5.6 Interactive Swagger & GraphQL Documentation](#56-interactive-swagger--graphql-documentation)
   - [5.7 Running Generated E2E Test Suites](#57-running-generated-e2e-test-suites)
6. [Keyboard Shortcuts & Productivity Tips](#6-keyboard-shortcuts--productivity-tips)

---

## 1. Prerequisites & Installation

### Requirements
- **Node.js**: v22.0.0 or later (v24 LTS recommended)
- **Rust & Cargo**: Required for building and running the Tauri desktop application ([Install Rust](https://rustup.rs))
- **Docker**: Optional, for one-command database container stacks and container verification

### Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/chz-nest.git
cd chz-nest
npm install
```

---

## 2. Launching the Studio

You can run `chz-nest` in two modes:

### Desktop Studio (Recommended)
Runs inside the native Tauri 2 desktop shell with native filesystem access, folder pickers, and OS-level persistent storage:

```bash
npm run tauri dev
```

### Browser Development Mode
Runs inside a standard web browser (useful for rapid UI testing or non-desktop environments). State falls back to browser `localStorage`:

```bash
npm run dev
```

---

## 3. Studio Workflow Walkthrough

### 3.1 Creating and Managing Projects
- Open the studio to access the **Projects** screen.
- Click **New Project** to configure:
  - **Project Name**: Human-readable name (e.g., `SaaS Marketplace`).
  - **Package Name**: npm/kebab-case identifier (e.g., `saas-marketplace-api`).
  - **Database Driver**: Choose **PostgreSQL** (default), **MySQL**, or **SQLite**.
  - **Enable Authentication**: Toggle built-in JWT user authentication.
- Projects are automatically persisted to the app-data directory with continuous debounced autosave.
- Full multi-step **Undo** (`Ctrl/Cmd + Z`) and **Redo** (`Ctrl/Cmd + Shift + Z`) are supported across all model modifications.

---

### 3.2 Project & Engine Settings
Navigate to the **Settings** tab to configure system-wide options:
- **Server Port & API Global Prefix**: Default port `3000`, prefix `/api` (configurable).
- **Database Driver Configuration**: Select dialect-specific connection defaults (host, port, credentials).
- **CORS & Security**: Allowed origins, credentials, and headers.
- **Docker Compose**: Automatically generate multi-stage `Dockerfile` and `docker-compose.yml` pre-wired with database healthchecks.
- **Mailer Configuration**: Configure SMTP credentials for email verification and password reset workflows.

---

### 3.3 Entity Designer (Fields, Types, Enums & Relations)
The **Entities** tab provides an interactive form-based designer for your data models:

#### Entities
- Create entities using singular `PascalCase` (e.g., `Post`, `Order`, `Customer`).
- Entity toggles:
  - **Timestamps**: Automatically adds and manages `createdAt` and `updatedAt`.
  - **Soft Delete**: Adds `deletedAt` with TypeORM `@DeleteDateColumn()`, creates admin-only restore endpoints, and filters soft-deleted rows by default.
  - **Pagination**: Wraps responses in standard pagination envelopes (`page`, `limit`, `total`, `totalPages`).

#### Fields
- Supported data types:
  - `string`, `text`, `int`, `float`, `boolean`, `date`, `datetime`, `uuid`, `enum`, `json`.
- Modifiers:
  - Primary Key (`uuid` or `autoincrement`).
  - Nullable / Optional.
  - Unique Constraint.
  - Default values.
  - Searchable (emits case-insensitive `ILIKE`/`LIKE` filters).
  - Sortable (enables whitelisted sorting, e.g., `?sort=-createdAt`).

#### Enums
- Define reusable enum types with custom string values (e.g., `OrderStatus = ['PENDING', 'PAID', 'SHIPPED', 'CANCELLED']`).

#### Relations
- Define relations with strict referential integrity:
  - **One-to-One** (`1:1`)
  - **One-to-Many / Many-to-One** (`1:N` / `N:1`)
  - **Many-to-Many** (`N:M`) with join table management.
- Inverse relations are automatically derived and normalized in `normalize.ts`.
- Configurable `onDelete` cascades (`CASCADE`, `SET NULL`, `RESTRICT`).

---

### 3.4 Authentication, 2FA & OAuth Configuration
Navigate to the **Auth** tab to configure identity security:
- **JWT Tokens**:
  - Configurable access token TTL (default: `15m`).
  - Rotating refresh token TTL (default: `7d`).
  - Passwords hashed using `bcrypt` (work factor 12).
- **Two-Factor Authentication (2FA / TOTP)**:
  - Authenticator app setup with QR code data URLs.
  - Single-use recovery codes.
  - Step-up authentication guard for sensitive endpoints.
- **OAuth 2.0 Social Logins**:
  - Enable **Google**, **GitHub**, and **Discord** authentication strategies.
  - Automatically emits Passport strategies and redirects.
- **Password Reset & Email Verification**:
  - Cryptographically secure single-use tokens.
  - Mailer integration with pre-styled HTML templates.

---

### 3.5 Granular Authorization & Row-Level Ownership
`chz-nest` includes an interactive **Access Matrix** governing permissions across every CRUD operation (`list`, `read`, `create`, `update`, `delete`, `restore`):
- **Access Levels**:
  - `Public`: Unprotected endpoint.
  - `Authenticated`: Any user with a valid JWT token.
  - `Roles`: Restricted to specific assigned roles (e.g., `ADMIN`, `MODERATOR`).
  - `Owner`: Strict row-level ownership isolation.
- **Ownership Invariants**:
  - Foreign rows return **404 Not Found** (never 403) to prevent resource existence leaking.
  - The studio automatically adds and indexes foreign-key owner relations pointing to `User`.
  - Last remaining admin accounts are protected against demotion and deletion.

---

### 3.6 Custom Endpoints & Business Logic
In the **Entities > Custom Endpoints** tab, you can declare custom controller routes:
- **HTTP Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- **Route Path**: Path segments with parameterized tokens (e.g., `posts/:id/publish`).
- **DTOs**: Auto-generates typed request body DTOs and query parameter validation schemas.
- **Access Guarding**: Inherits the Access Matrix or overrides specific role/owner requirements.
- **Caching & Throttling**: Configure route-level cache TTL and request limit overrides.

---

### 3.7 File Uploads & Storage Attachments
Configure file handling directly in **Settings > Storage**:
- **Storage Drivers**:
  - **Local Storage**: Saves files to disk under `./uploads/` with filename hashing.
  - **AWS S3 / S3-Compatible**: Direct upload to Cloudflare R2, MinIO, or AWS S3.
- **Attachment Entity**: Auto-emits an `Attachment` TypeORM entity tracking filename, mime type, byte size, and URL.
- **Validation Rules**: Configurable file size limits and MIME-type whitelists (e.g., `image/*`, `application/pdf`).

---

### 3.8 Multi-Tenancy Scoping
For SaaS applications, toggle **Multi-tenancy** in Settings:
- Automatically injects and associates a `Tenant` entity.
- Configurable tenant resolution strategies:
  - `Header`: Extracts `X-Tenant-ID`.
  - `Subdomain`: Extracts subdomain prefix from request host.
  - `Route Parameter`: Scoped via `/:tenantId/...`.
- All database queries and insertions are automatically filtered and scoped by tenant context.

---

### 3.9 Rate Limiting & Cache Hints
Configure performance optimization rules in **Settings > Throttling & Cache**:
- **Rate Limiting**: Emits `@nestjs/throttler` configurations with customizable sliding windows and limits.
- **Response Caching**: Emits `@nestjs/cache-manager` with in-memory or Redis stores and HTTP `Cache-Control` header hints.

---

### 3.10 Code-First GraphQL Generation
When GraphQL is enabled:
- Generates code-first GraphQL `@ObjectType()`, `@InputType()`, and `@ArgsType()` schemas.
- Emits NestJS `@Resolver()` classes with `@Query()` and `@Mutation()` operations mirroring REST capabilities.
- Automatically wires Apollo Driver (`@nestjs/apollo`) into `AppModule`.
- Integrates the same JWT guards and ownership scoping into GraphQL context.

---

### 3.11 Model Semantic Validation
The studio continuously runs background semantic validation:
- Validates identifier naming (no collisions, valid SQL and TypeScript identifiers).
- Enforces bidirectional relation consistency.
- Checks owner relations for entities using `Owner` access level.
- Prevents misconfigurations (e.g., missing relations, circular cascade deletes, empty roles).
- Click the **Validation Badge** in the header to view and navigate directly to invalid fields.

---

### 3.12 Code Preview, Monaco Diff Viewer & Export
The **Generate** screen gives you full transparency before writing a single byte to disk:
- **Instant Raw Preview**: Generated file tree and syntax-highlighted code load in `<300ms` with background Prettier formatting.
- **Monaco Diff Viewer**:
  - If exporting into an existing directory, the studio compares the disk file, current model output, and previous manifest.
  - Files are categorized as:
    - `Unchanged`: File on disk matches generator output.
    - `Generator Updated`: Model changed in the studio.
    - `Disk Modified`: File was edited manually by a developer.
    - `Untracked`: Extra files present in the folder.
- **Three-Way Conflict Resolution**:
  - `Overwrite`: Replace disk version with generator output.
  - `Skip`: Preserve your manual edits on disk.
  - `Save as .new`: Write `filename.ts.new` for manual diff merging.
- **Export Options**:
  - **Export ZIP**: Download a packaged archive with SHA-256 integrity manifest.
  - **Write to Folder**: Select a folder on your system for direct, atomic disk writing.

---

## 4. Standalone CLI Usage

`chz-nest` includes a standalone Node.js CLI (`chz`) to validate models and generate projects in CI/CD pipelines or headless scripts.

### Basic Syntax
```bash
npm run chz -- <command> <project.json> [options]
```

### 1. Validate a Project Model
Check if a project JSON is valid without generating files:
```bash
npm run chz -- validate my-project.json
```
To receive machine-readable JSON output:
```bash
npm run chz -- validate my-project.json --json
```

### 2. Generate a Project to Disk
Generate a full project scaffold:
```bash
npm run chz -- generate my-project.json --out ./my-api
```

### 3. CLI Options & Flags
| Flag | Description |
| --- | --- |
| `--out <dir>` | Destination folder for the generated project (defaults to `./<packageName>`). |
| `--dry-run` | Evaluates the export plan and outputs file actions without modifying the filesystem. |
| `--overwrite` | Overwrites files that were manually edited on disk. |
| `--raw` | Skips Prettier formatting for sub-second generation speed. |
| `--json` | Outputs execution reports in JSON format. |

### CLI Exit Codes
- `0`: Success.
- `1`: Invalid command-line usage or arguments.
- `2`: Invalid model (zero files written, validation errors reported).
- `3`: Filesystem write or permission error.

---

## 5. Working with the Generated NestJS Application

When you export a project, you receive a self-contained, production-ready NestJS repository.

### 5.1 Project Layout
```
my-api/
├── src/
│   ├── auth/              # JWT, 2FA, OAuth strategies, guards & controllers
│   ├── common/            # Filters, interceptors, pagination, access context
│   ├── config/            # TypeORM, Swagger, Throttler & Cache configs
│   ├── database/
│   │   ├── migrations/    # TypeORM database migration files
│   │   └── seeds/         # Deterministic seed runner (users, roles, data)
│   ├── modules/           # One isolated module per entity (Entity, DTOs, Service, Controller, Resolver)
│   ├── users/             # User management, roles, and profile endpoints
│   ├── app.module.ts      # Root NestJS module wiring all dependencies
│   └── main.ts            # Bootloader with security headers, CORS & validation pipes
├── test/                  # E2E test suites (Jest + Supertest)
├── Dockerfile             # Multi-stage optimized Docker build
├── docker-compose.yml     # Container stack (API + Database)
├── package.json           # All dependencies and scripts
└── tsconfig.json          # Strict TypeScript configuration
```

### 5.2 Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key environment variables:
```ini
PORT=3000
NODE_ENV=development

# Database Credentials
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=my_api_db

# Security Secrets (Must be changed in production)
JWT_SECRET=super-secret-jwt-key
JWT_REFRESH_SECRET=super-secret-refresh-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 5.3 Database Setup, Migrations & Seeds
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run database migrations:
   ```bash
   npm run migration:run
   ```
3. Run database seed (creates initial roles, admin user, and sample data):
   ```bash
   npm run seed
   ```
   To reset and re-seed from scratch:
   ```bash
   npm run seed -- --reset
   ```

### 5.4 Running the Application
```bash
# Development mode with hot-reload
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

### 5.5 Docker & Docker Compose Deployment
Boot the entire API and database stack with a single command:
```bash
docker compose up --build -d
```
The compose file automatically waits for database health before executing migrations, running seeds, and starting the NestJS application.

### 5.6 Interactive Swagger & GraphQL Documentation
- **Swagger REST Documentation**: Open `http://localhost:3000/docs` in your browser. Includes interactive endpoints, JWT bearer authorization, and schema inspectors.
- **GraphQL Playground**: Open `http://localhost:3000/graphql` to explore the interactive schema, queries, and mutations.

### 5.7 Running Generated E2E Test Suites
Every exported entity includes end-to-end tests covering authentication, access control, and CRUD behavior:
```bash
npm run test:e2e
```

---

## 6. Keyboard Shortcuts & Productivity Tips

| Shortcut | Action |
| --- | --- |
| `Ctrl / Cmd + Z` | Undo last model modification |
| `Ctrl / Cmd + Shift + Z` | Redo last model modification |
| `Ctrl / Cmd + Enter` | Trigger instant project code generation |
| `Up / Down Arrows` | Navigate between entities in the sidebar |
| `Escape` | Close any active modal or dialog |
| `?` | Show keyboard shortcuts reference modal |

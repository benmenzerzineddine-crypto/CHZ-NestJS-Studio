# Step 12 — Multi-tenancy Scoping (M5f)

**Goal:** Provide multi-tenant data isolation for generated NestJS projects, supporting request-level tenant resolution via configurable HTTP header (or JWT claim fallback), automated discriminator column (`tenantId`) persistence, query scoping in services, and OpenAPI tenant header declarations.

- **Depends on:** [`11-file-uploads-and-attachments.md`](11-file-uploads-and-attachments.md) (M5e accepted)
- **Plan reference:** `plan.md` §5, §9; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- Schema extension:
  - `multitenancyConfigSchema`: `{ enabled: boolean, header: string }` where header defaults to `"x-tenant-id"`.
  - Added to `projectSettingsSchema` as `multitenancy: multitenancyConfigSchema.default({ enabled: false, header: "x-tenant-id" })`.
  - Added `multitenant: z.boolean().default(false)` to `entityOptionsSchema`.
- Semantic validation:
  - Header name syntax verification (kebab-case alphanumeric header).
  - Collision check: entity cannot define a custom field named `tenantId` when `multitenant: true`.
- IR & Emitters:
  - `MultitenancyIR` attached to `ProjectIR`.
  - `multitenant: boolean` on `EntityIR`.
  - Emitters (`src/core/emit/`):
    - `entity.ts`: Emits indexed `@Column({ name: "tenant_id", type: "varchar", length: 64 }) tenantId: string;` on multitenant entities.
    - `dto.ts`: Omits `tenantId` from Create & Update DTOs so clients cannot spoof or tamper with tenant assignment.
    - `common.ts`: Emits `@CurrentTenant()` param decorator and `applyTenantScope(qb, tenantId)` query builder helper in `src/common/access.ts` (or `tenant.ts`).
    - `service.ts`: Enforces tenant scoping on `findAll`, `findOne`, `create`, `update`, `remove`, and `restore`. `create` assigns `entity.tenantId = tenantId`.
    - `controller.ts`: Injects `@CurrentTenant() tenantId: string` and annotates with `@ApiHeader({ name: header, description: "Tenant identifier", required: true })`.
- Studio UI:
  - Settings screen: Multi-tenancy section with enable toggle and tenant header name input.
  - Entity Designer: Option toggle for "Multi-tenant" on entity options.
  - Endpoints review: Displays tenant header requirement badge/note on multitenant routes.
- Testing:
  - Unit tests for schema, validation, IR, emitters, and store.
  - Zero snapshot drift for legacy fixtures (`blog.json`).

**Out:**
- Dynamic multi-database / schema-per-tenant isolation (v1 focuses on shared-database discriminator column pattern, which is the most common and standard TypeORM multi-tenancy architecture).

---

## Tasks

### 12.1 Schema & Defaults
- [x] Add `multitenancyConfigSchema` to `src/core/model/schema.ts` and attach `multitenancy` to `projectSettingsSchema`.
- [x] Add `multitenant: z.boolean().default(false)` to `entityOptionsSchema`.
- [x] Update `defaultSettings` and `createEntity` in `src/core/model/defaults.ts`.
- [x] Update `src/core/model/schema.test.ts` and `src/core/model/defaults.test.ts`.

### 12.2 Validation Engine
- [x] Add validation in `src/core/validate/validate.ts` for tenant header format and `tenantId` field collision.
- [x] Update `src/core/validate/validate.test.ts`.

### 12.3 IR & Emitters
- [x] Attach `MultitenancyIR` to `ProjectIR` and `multitenant` to `EntityIR` in `src/core/ir/types.ts` & `src/core/ir/build.ts`.
- [x] Emit `tenantId` column in `src/core/emit/entity.ts` when `entity.multitenant` is true.
- [x] Exclude `tenantId` in `src/core/emit/dto.ts`.
- [x] Emit `applyTenantScope` and `@CurrentTenant()` in `src/core/emit/common.ts`.
- [x] Update `src/core/emit/service.ts` to scope queries and assign tenant on create.
- [x] Update `src/core/emit/controller.ts` with `@CurrentTenant()` and `@ApiHeader`.
- [x] Add unit tests in `src/core/emit/multitenancy.test.ts`.

### 12.4 Studio UI Integration
- [x] Add store mutators in `src/store/project.store.ts` for updating multi-tenancy settings.
- [x] Add Multi-tenancy section to `src/features/settings/SettingsScreen.tsx`.
- [x] Add Multi-tenant toggle in Entity options panel (`EntityOptionsForm.tsx` or entity inspector).
- [x] Update `src/features/endpoints/EndpointsScreen.tsx` to indicate tenant scoping.

### 12.5 Verification & Hardening
- [x] Verify zero snapshot drift on `blog.json`.
- [x] Run `npm test` across all suites.
- [x] Run `npm run build`.
- [x] Verify CLI `validate` and `generate`.

---

## Definition of Done

1. Existing models with multi-tenancy disabled generate 100% byte-identical code.
2. When multi-tenancy is enabled and an entity is marked multitenant, the entity has a `tenantId` column, DTOs omit it, controller extracts it via `@CurrentTenant()`, and services strictly scope queries to the tenant.
3. Access across tenants returns 404 (preventing information leakage).
4. Studio UI supports configuring multi-tenancy settings and toggling entity multi-tenancy.
5. All test suites pass with zero regressions.

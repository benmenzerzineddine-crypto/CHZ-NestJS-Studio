# Step 10 — Custom Endpoints (M5d)

**Goal:** allow developers to define custom HTTP routes directly in the entity designer
(method, path, access rule, description), emitted into the generated controller and
service as clean stubs with TODO markers, type-checked parameter bindings, and access
matrix integration.

- **Depends on:** [`09-password-reset-and-email-verification.md`](09-password-reset-and-email-verification.md) (M5c accepted)
- **Plan reference:** `plan.md` §5, §9; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- Schema extension:
  - `customEndpointSchema` (`id`, `name`, `method`, `path`, `access`, `description?`).
  - Added to `entityDefinitionSchema` as `customEndpoints: z.array(customEndpointSchema).default([])`.
- Semantic validation:
  - Validates `name` (camelCase, unique within entity, non-collision with standard CRUD names).
  - Validates `path` syntax and prevents colliding routes on the same HTTP method.
  - Role reference validation when access level is `roles`.
  - Owner validation when access level is `owner`.
- IR & Emitters:
  - Emitter in `src/core/emit/controller.ts`: emits `@Get`, `@Post`, `@Patch`, `@Delete`, `@Put` with access decorators (`@Public()`, `@Roles(...)`, `@ApiBearerAuth()`), params (`@Param('id')` for `:id` segments), and `@CurrentUser()`.
  - Emitter in `src/core/emit/service.ts`: emits typed method stubs with `TODO` comments.
- Studio UI:
  - "Custom Endpoints" editor in `src/features/designer/EntityDetail.tsx` (add/edit/delete custom routes).
  - Add Custom Endpoint dialog with method selector, path input, name, and access rule picker.
  - Integration with `EndpointsScreen.tsx` review table with a distinct "Custom" indicator.
- Testing:
  - Unit tests for validation, schema, IR normalization, and code emission.
  - Zero snapshot drift for existing fixtures (`blog.json`).

**Out:**
- Writing full arbitrary handler TypeScript code inside the studio UI (the studio generates clean stubs with TODO comments for developers to implement in their IDE).
- AST merging into existing repositories (standard whole-project / manifest export).

---

## Tasks

### 10.1 Schema & Defaults
- [x] Add `httpMethodSchema` and `customEndpointSchema` to `src/core/model/schema.ts`.
- [x] Add `customEndpoints` array with `.default([])` to `entityDefinitionSchema`.
- [x] Add factory `createCustomEndpoint` in `src/core/model/defaults.ts`.
- [x] Update `src/core/model/schema.test.ts`.

### 10.2 Validation Rules
- [x] Add validation rules in `src/core/validate/validate.ts`:
  - Disallow reserved CRUD method names (`create`, `findAll`, `findOne`, `update`, `remove`, `restore`).
  - Disallow duplicate endpoint names within an entity.
  - Disallow duplicate method + path within an entity.
  - Validate role references if `access.level === 'roles'`.
  - Ensure entity has owner enabled if `access.level === 'owner'`.
- [x] Add unit tests in `src/core/validate/validate.test.ts`.

### 10.3 IR & Emitters
- [x] Normalize custom endpoints in `src/core/ir/build.ts` and attach to `EntityIR`.
- [x] Emit custom endpoint methods in `src/core/emit/controller.ts`.
- [x] Emit custom endpoint stubs in `src/core/emit/service.ts`.
- [x] Add unit tests in `src/core/emit/controller.test.ts` and `src/core/emit/custom-endpoints.test.ts`.

### 10.4 Studio UI
- [x] Create `CustomEndpointsEditor.tsx` and `AddCustomEndpointDialog.tsx` under `src/features/designer/`.
- [x] Mount editor in `src/features/designer/EntityDetail.tsx`.
- [x] Display custom endpoints in `src/features/endpoints/EndpointsScreen.tsx`.
- [x] Add store actions in `src/store/project.store.ts` (`addCustomEndpoint`, `removeCustomEndpoint`, `updateCustomEndpoint`).

### 10.5 Verification & Hardening
- [x] Run `npm test` across all 36 test suites (325/325 tests passing).
- [x] Run `npm run build` (tsc and vite build clean).
- [x] Verify CLI `validate` and `generate` with a custom endpoint model.

---

## Definition of Done

1. When `customEndpoints` is empty, generated files are 100% byte-identical to previous releases.
2. Custom endpoints emit the requested HTTP method decorator, path, access decorators, and parameter bindings in controllers.
3. Matching service stubs are emitted with TODO comments.
4. Validation prevents route collisions, invalid identifiers, and broken role references.
5. All new and existing tests pass (`npm test` and `npm run build`).

---

## Verification Results

```bash
npm test
# Test Files  36 passed (36)
# Tests       325 passed (325)

npm run build
# built in 1.77s (tsc clean)

npm run chz -- validate src/core/fixtures/blog.json
# Blog API (blog-api): 0 errors, 0 warnings
```

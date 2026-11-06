# Step 02 — Model designer & auth configuration (M1)

**Goal:** build the form-based data model editor, enums, relations, the auth
settings panel, the per-entity access matrix, and the semantic validation engine
that guards the generator.

- **Depends on:** [`01-foundation.md`](01-foundation.md)
- **Plan reference:** `plan.md` §4, §6
- **Next step:** [`03-generator-core.md`](03-generator-core.md)

---

## Scope

**In:** entity list/detail, field editor, enums, relations, validation engine,
auth settings, access matrix, owner auto-relation, read-only endpoints review,
`blog.json` fixture.

**Out:** code preview, export, any generated files.

---

## Tasks

### 2.1 Entities screen

- [x] Two-pane layout: searchable entity list with add/duplicate/delete; detail
      pane for the selected entity.
- [x] Built-in `User` entity is always present, marked "system", editable for
      extra fields, and cannot be deleted or renamed.
- [x] Rename entity with automatic singular/plural derivation (`pluralize`),
      showing the derived REST path (`/api/posts`).
- [x] Entity description, timestamps, soft delete, pagination toggles.
- [x] Guard against duplicate names (case-insensitive) and reserved names.

**Files:** `src/features/designer/entities/*`, `src/store/selectors.ts`

### 2.2 Field editor

- [x] Editable table: drag/reorder, name, type, required, unique, indexed,
      primary, default, type-specific options.
- [x] Type-specific controls:
      - `string` → length (default 255)
      - `decimal` → precision/scale
      - `enum` → enum picker
      - `int`/`float` → min/max validators
      - `string`/`text` → min/max length, regex pattern
- [x] Inline validation: identifier syntax (`camelCase`), duplicates, only one
      primary field, primary must be `uuid` or `int`, PK cannot be nullable.
- [x] Add-field menu, delete with confirmation when referenced in
      `searchFields`/`sortFields`.
- [x] `password`-like fields are not offered: auth fields belong to the system
      `User` entity only.

**Files:** `src/features/designer/fields/*`

### 2.3 Enums editor

- [x] Project-level enum list: name, values (ordered), delete guard when used.
- [x] Enum values validated: unique, identifier-safe, non-empty.
- [x] Selecting an `enum` field lists only valid enums; orphaned refs surface in
      the validation panel.

**Files:** `src/features/designer/enums/*`

### 2.4 Relations editor

- [x] Add relation: target entity (including system `User`), kind
      (`many-to-one`, `one-to-many`, `one-to-one`, `many-to-many`), nullable,
      cascade, served by a property name.
- [x] Inverse side is **derived** and shown read-only; users never edit both ends.
- [x] Validation: target exists, no duplicate property names, inverse name
      collisions, self-relations allowed, `one-to-many` must have a matching
      `many-to-one` target (normalized into one canonical relation under the hood).
- [x] Delete relation with confirmation; owner relation is managed by the access
      matrix and cannot be deleted directly.

**Files:** `src/features/designer/relations/*`

### 2.5 Validation engine

- [x] `src/core/validate/validate.ts`: pure `validateProject(project): Issue[]`
      where `Issue = { code, severity, entityId?, fieldId?, relationId?, message, fixHint? }`.
- [x] Rules:
      - identifiers (PascalCase entities, camelCase fields/relations, kebab paths)
      - duplicates and reserved names (`User`, `RefreshToken`, `Auth`)
      - enum references exist and have values
      - relation integrity + inverse symmetry
      - exactly one PK per entity (or implicit uuid)
      - `searchFields` / `sortFields` point to scalar fields only
      - `owner` access used but entity lacks an owner relation
      - role rules reference defined roles; at least one role when any rule uses `roles`
      - `admin` role required for admin user endpoints
      - admin/seed flags meaningless when auth disabled → warning
- [x] `ValidationPanel` in the sidebar: grouped by severity, click navigates to the
      offending entity/field, live count badge.
- [x] Unit tests per rule, including valid `blog.json` → zero errors.

**Files:** `src/core/validate/*`, `src/features/validation/*`

### 2.6 Auth settings panel

- [x] Toggle auth; register toggle; refresh tokens; access/refresh TTL inputs with
      duration validation (`15m`, `7d`); password min length (6–72 for bcrypt).
- [x] Seed admin toggle + note that `ADMIN_EMAIL`/`ADMIN_PASSWORD` are env vars.
- [x] Admin user endpoints toggle.
- [x] Roles list editor: add/remove/rename, key + label, `admin` and `user` are
      defaults, `admin` cannot be removed (needed for ownership bypass).
- [x] Renaming/removing a role updates access rules (or blocks with a clear
      "used by N rules" guard).
- [x] Locked state when auth is disabled, with a note that rules are ignored.

**Files:** `src/features/auth/AuthSettings.tsx`

### 2.7 Access matrix

- [x] Table per entity: rows = list/read/create/update/delete, columns = level +
      role multi-select.
- [x] Level selector: public / authenticated / roles / owner; role checkboxes
      enabled only for `roles`.
- [x] Selecting `owner` anywhere on an entity:
      - prompts to add the owner relation (once),
      - sets `options.owner = true`,
      - refuses to save rules if the user declines.
- [x] Warnings: `public` on write operations, `owner` without owner relation,
      unknown role references.
- [x] When project auth is disabled, show the matrix greyed out with a banner.
- [x] Store tests: rule edits, role rename propagation, owner relation lifecycle.

**Files:** `src/features/auth/AccessMatrix.tsx`, `src/store/project.store.ts`

### 2.8 Endpoints review

- [x] Derive the route table from the model (method, path, access badge, params).
- [x] Include auth routes and admin user routes when enabled; health route always.
- [x] Read-only in M1; custom endpoints arrive in M5.
- [x] Search/filter by entity.

**Files:** `src/features/endpoints/EndpointsScreen.tsx`

### 2.9 Diagram-lite (optional, last)

- [ ] Read-only SVG: auto-laid-out entity boxes with field lists and relation edges
      (no drag, no editing), used as a sanity view.
- [ ] Skip if it delays 2.5–2.7.

**Files:** `src/features/designer/DiagramLite.tsx`

### 2.10 Blog fixture

- [x] `src/core/fixtures/blog.json`: `User`, `Post`, `Tag`, `Comment`;
      enum `PostStatus` (`draft`, `published`, `archived`); relations
      `Post.author → User` (many-to-one), `Post.tags ↔ Tag` (many-to-many),
      `Comment.post → Post`, `Post.comments` inverse; access rules mixing public
      list, owner update, admin delete.
- [x] Test: fixture matches schema and validates with zero errors.
- [x] Fixture is the single source of truth for generator snapshots in M2/M3.

---

## Definition of done

1. The blog fixture can be built entirely through the UI and validates cleanly.
2. Every validation rule has a test and a navigable UI issue.
3. Auth settings + access matrix round-trip through save/reopen unchanged.
4. Selecting `owner` creates exactly one owner relation; removing the last owner
   rule removes it.
5. Endpoints screen matches the model, including access badges.

---

## Verification

- [x] `npm test` (schema, validation, store).
- [x] `npm run build`.
- [ ] Manual: create blog model, close app, reopen → identical model.
- [ ] Manual: break the model (duplicate field, bad role, missing owner) → each
      issue appears and navigates correctly.

---

## Notes

- Keep relation normalization in `src/core/model/normalize.ts` so the generator
  consumes one canonical shape, not both sides.
- The access matrix is the only place that flips `options.owner`.
- Do not add generation-related UI in this step; the Generate screen stays a placeholder.

---

## Implementation notes (2026-10-23)

- **Done:** every required task in 2.1–2.8 and 2.10. Diagram-lite (2.9) was
  intentionally skipped because it is optional and would delay the required
  screens. Manual desktop checks remain open.
- **Canonical relations:** only `many-to-one`, `one-to-one` and `many-to-many`
  are stored. Adding a one-to-many from the UI creates the canonical
  many-to-one on the target entity; the inverse is always derived. Imported
  projects that still contain a stored one-to-many entry get a validation
  warning instead of silent rewriting.
- **Inverse names:** `src/core/model/normalize.ts` derives the inverse side and
  disambiguates collisions (`posts`, then `postsAsOwner`, then numeric
  suffixes). No stored relation is edited on both ends.
- **Ownership:** `EntityOptions` gained an optional `ownerRelation` property so
  the managed relation is explicit and survives renames. New entities start
  with ownership enabled (matching the default `update: owner` rule), so the
  model is valid immediately. Removing the last owner rule removes the managed
  relation; selecting owner again recreates exactly one.
- **Persisted-input safety:** identifier, duration and enum-value inputs commit
  on blur/Enter through `BufferedInput`. This prevents the debounced autosave
  from ever writing a half-typed project that would fail `migrateProject` on
  reopen.
- **System User guard:** the built-in `email` field cannot be renamed, retyped
  or deleted. Extra fields on `User` remain editable. `password`,
  `passwordHash` and `roles` are reserved field names everywhere because the
  auth module owns those columns and generic DTOs must never carry secrets.
- **Endpoints:** the review includes CRUD, soft-delete restore, health, auth and
  admin user routes, with access badges derived from the matrix.
- **Checks run:** `npm test` (95 tests, including the blog fixture with zero
  issues) and `npm run build`.
- **Manual checks pending:** desktop create/close/reopen and the interactive
  issue-navigation walk-through.

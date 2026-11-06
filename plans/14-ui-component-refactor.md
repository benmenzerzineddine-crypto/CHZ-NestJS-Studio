# Step 14 — UI Component Refactor (M5h)

**Goal:** Refactor monolithic UI views and duplicated layout patterns into composable, accessible primitives and modular sub-components across the studio desktop app (`src/components/ui/` and `src/features/`), improving maintainability, consistency, and testability while preserving 100% of existing behavior and test coverage.

- **Depends on:** [`13-rate-limiting-and-cache-hints.md`](13-rate-limiting-and-cache-hints.md) (M5g accepted)
- **Plan reference:** `plan.md` §2, §9; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- **Shared UI Primitives (`src/components/ui/`):**
  - `confirm-delete-dialog.tsx`: Reusable confirmation modal for deleting entities, fields, relations, custom endpoints, and enums with accessible dialog header, description, cancel button, and danger action button.
  - `card-section.tsx`: Reusable card wrapper with header (title, description, optional action slot) and structured content body.
  - `form-row.tsx`: Unified key-value row with label, hint, htmlFor, and right-aligned input/switch/select slot (replacing duplicated `FieldRow` and `ToggleRow` patterns).
  - `method-badge.tsx`: Shared HTTP method badge component with standardized styling and variant mappings (`GET` -> success, `POST` -> accent, `PUT`/`PATCH` -> warning, `DELETE` -> danger).
- **Entity Designer Decomposition (`src/features/designer/`):**
  - Break down monolithic [`src/features/designer/EntityDetail.tsx`](../src/features/designer/EntityDetail.tsx) (>510 lines) into focused, single-responsibility subcomponents:
    - `EntityHeader.tsx`: Entity name input with rename validation, REST path preview, system entity badge, duplicate and delete actions using `ConfirmDeleteDialog`.
    - `EntityOptionsCard.tsx`: Standard entity toggles (timestamps, softDelete, pagination, multitenant) using `FormRow`.
    - `EntitySearchSortCard.tsx`: Searchable and sortable field chip pickers.
    - `EntityOwnershipCard.tsx`: Ownership status badge and access matrix link/info.
    - `EntityPerformanceCard.tsx`: Controller request throttling overrides and response `Cache-Control` hints.
  - Adopt `ConfirmDeleteDialog` in [`FieldsEditor.tsx`](../src/features/designer/FieldsEditor.tsx), [`RelationsEditor.tsx`](../src/features/designer/RelationsEditor.tsx), and [`CustomEndpointsEditor.tsx`](../src/features/designer/CustomEndpointsEditor.tsx).
- **Settings Screen Refactor (`src/features/settings/`):**
  - Refactor [`src/features/settings/SettingsScreen.tsx`](../src/features/settings/SettingsScreen.tsx) to use `CardSection` and `FormRow`, eliminating duplicated local flex/grid layout boilerplate across Project, Database, Auth, Storage, Multi-tenancy, and Throttling sections.
- **Endpoints Consistency (`src/features/endpoints/`):**
  - Adopt `MethodBadge` across [`CustomEndpointsEditor.tsx`](../src/features/designer/CustomEndpointsEditor.tsx) and [`EndpointsScreen.tsx`](../src/features/endpoints/EndpointsScreen.tsx), removing duplicated `METHOD_VARIANTS` mappings.
- **Testing & Quality Assurance:**
  - Dedicated unit tests for new primitives (`confirm-delete-dialog.test.tsx`, `form-row.test.tsx`, `card-section.test.tsx`, `method-badge.test.tsx`).
  - Maintain 100% pass rate across all existing unit, integration, and UI tests (no changes to `aria-label`, IDs, or user-visible interactions).
  - Clean production build (`npm run build`).

**Out:**
- No changes to generator core (`src/core/`), IR, emitters, or CLI commands.
- No changes to project schema (`schema.ts`) or Zustand store state shapes.
- No visual redesign; all Tailwind color tokens, font sizes, borders, and layouts remain visually identical.

---

## Tasks

### 14.1 Shared UI Primitives
- [x] Create `src/components/ui/confirm-delete-dialog.tsx`:
  - Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel?`, `onConfirm`.
  - Accessible Radix Dialog wrapping standard confirmation header, description, and footer.
- [x] Create `src/components/ui/card-section.tsx`:
  - Props: `title`, `description?`, `action?`, `children`, `className?`.
  - Section wrapper with standardized border, background, and header division.
- [x] Create `src/components/ui/form-row.tsx`:
  - `FormRow` (label, hint, htmlFor, children).
  - `ToggleRow` (label, hint, checked, onCheckedChange, disabled, ariaLabel).
- [x] Create `src/components/ui/method-badge.tsx`:
  - Export `MethodBadge` and `METHOD_BADGE_VARIANTS` supporting `HttpMethod` (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- [x] Add unit tests for new primitives in `src/components/ui/*.test.tsx`.

### 14.2 Entity Detail Decomposition
- [x] Create `src/features/designer/components/EntityHeader.tsx`:
  - Extract entity renaming, duplicate button, and delete confirmation dialog.
- [x] Create `src/features/designer/components/EntityOptionsCard.tsx`:
  - Extract timestamps, soft-delete, pagination, and multi-tenant switches.
- [x] Create `src/features/designer/components/EntitySearchSortCard.tsx`:
  - Extract searchable and sortable field chip lists.
- [x] Create `src/features/designer/components/EntityOwnershipCard.tsx`:
  - Extract ownership status and relation badge.
- [x] Create `src/features/designer/components/EntityPerformanceCard.tsx`:
  - Extract rate limit override and response cache hints forms.
- [x] Refactor `src/features/designer/EntityDetail.tsx` to compose the above subcomponents.
- [x] Verify `src/features/designer/EntityDetail.test.tsx` passes.

### 14.3 Settings Screen Refactor
- [x] Replace local `Section`, `FieldRow`, and `ToggleRow` in `src/features/settings/SettingsScreen.tsx` with `CardSection`, `FormRow`, and `ToggleRow` from `@/components/ui/`.
- [x] Ensure all input labels, `aria-label`s, and `htmlFor` attributes match existing identifiers exactly.
- [x] Verify `src/features/settings/SettingsScreen.test.tsx` passes.

### 14.4 Dialog & Badge Standardization
- [x] Update `src/features/designer/FieldsEditor.tsx` to use `ConfirmDeleteDialog`.
- [x] Update `src/features/designer/RelationsEditor.tsx` to use `ConfirmDeleteDialog`.
- [x] Update `src/features/designer/CustomEndpointsEditor.tsx` to use `ConfirmDeleteDialog` and `MethodBadge`.
- [x] Update `src/features/endpoints/EndpointsScreen.tsx` to use `MethodBadge`.
- [x] Verify `src/features/designer/CustomEndpointsEditor.test.tsx` and `src/features/endpoints/EndpointsScreen.test.tsx` pass.

### 14.5 Verification & Regression Testing
- [x] Run full test suite: `npm test`.
- [x] Run production build: `npm run build`.
- [x] Update documentation and mark tasks completed in `plans/README.md`.

---

## Acceptance Criteria

1. **Zero Behavioral or Visual Regressions:**
   - All interactive controls (inputs, switches, dropdowns, modal dialogs) function identically.
   - All existing tests in `src/features/**/*.test.tsx` pass without modification.
2. **Code Maintainability:**
   - `EntityDetail.tsx` size reduced from ~510 lines to <100 lines by delegating to cohesive card subcomponents.
   - `SettingsScreen.tsx` eliminates duplicate layout boilerplate.
   - Reusable `ConfirmDeleteDialog` eliminates duplicated modal boilerplate across 4+ editors.
   - Duplicate `METHOD_VARIANTS` mappings consolidated into a single `MethodBadge` primitive.
3. **Automated Verification:**
   - 100% test pass rate across the full test suite (`npm test`).
   - Clean production bundle build (`npm run build`).

---

## Verification Commands

```bash
# Run all tests
npm test

# Run UI component tests specifically
npm test src/components/ui
npm test src/features

# Verify production bundle builds cleanly
npm run build
```

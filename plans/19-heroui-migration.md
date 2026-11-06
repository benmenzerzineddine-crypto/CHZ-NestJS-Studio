# Step 19 — HeroUI v3 UI Migration (M5m)

**Goal:** Migrate the studio desktop application's component primitives and feature views from the custom Radix UI + CVA setup to **HeroUI v3** (`@heroui/react` + `@heroui/styles`), adopting its accessible compound components, modern BEM/oklch design tokens, and smooth interaction states while preserving 100% of existing behavior, test coverage, and core architecture purity.

- **Depends on:** [`18-graphql-resolvers.md`](18-graphql-resolvers.md) (M5l accepted)
- **Plan reference:** `plan.md` §2, §9; [`DESIGN.md`](../DESIGN.md); [`AGENTS.md`](../AGENTS.md)
- **Status:** ready / in planning

---

## 1. Objectives & Architectural Principles

1. **Native Tailwind CSS v4 + React 19 Alignment:**
   HeroUI v3 is purpose-built for Tailwind CSS v4 and React 19, matching our current stack without compatibility layers.
2. **Accessible React Aria Foundation:**
   HeroUI is built on React Aria Components, providing robust keyboard navigation, focus management, screen-reader semantics, and ARIA attributes out of the box.
3. **Compound Component Composition:**
   Adhere to HeroUI v3's compound component anatomy (e.g. `Card.Header`, `Modal.Content`, `Select.Item`) instead of legacy flat props.
4. **Preserve Project Invariants:**
   - **Core Purity:** Zero changes to `src/core/` (pure TS, no DOM/React dependencies).
   - **Store Actions:** Zustand store actions and state shapes remain untouched.
   - **Zero Regression:** All 53 test suites (443+ tests) must remain 100% passing.
   - **Look & Feel:** Match or elevate our dark studio theme using HeroUI's semantic oklch tokens and `DESIGN.md` guidelines.

---

## 2. Component Mapping & Strategy

| Current Custom Primitive (`src/components/ui/`) | Underlying Dependency | HeroUI v3 Target Component | Migration Strategy / Compatibility Adapter |
| --- | --- | --- | --- |
| `Button` | CVA + HTML `<button>` | `Button` (`@heroui/react`) | Wrap HeroUI `Button`, map `variant` (`primary` -> `primary`, `secondary` -> `secondary`, `ghost` -> `ghost`, `danger` -> `danger`), support both `onClick` and `onPress`. |
| `Input` / `BufferedInput` | HTML `<input>` | `Input` / `TextField` (`@heroui/react`) | Wrap HeroUI `Input`, retain buffered change/blur semantics and existing input styling. |
| `Textarea` | HTML `<textarea>` | `TextArea` / `TextField` (`@heroui/react`) | Wrap HeroUI `TextArea`. |
| `Switch` | `@radix-ui/react-switch` | `Switch` (`@heroui/react`) | Replace Radix Switch with HeroUI compound `Switch`. Map `checked` / `onCheckedChange` to HeroUI `isSelected` / `onChange`. |
| `Checkbox` | HTML `<input type="checkbox">` | `Checkbox` (`@heroui/react`) | Wrap HeroUI `Checkbox`, maintaining form-binding semantics. |
| `Select` | Native HTML `<select>` | `Select` (`@heroui/react`) | Enhance with HeroUI accessible `Select` + `Select.Item`, while preserving simple option array compatibility. |
| `Dialog` / `ConfirmDeleteDialog` | `@radix-ui/react-dialog` | `Modal` / `AlertDialog` (`@heroui/react`) | Implement via HeroUI `Modal` (`Modal.Content`, `Modal.Header`, `Modal.Body`, `Modal.Footer`), maintaining `ConfirmDeleteDialog` API. |
| `Badge` / `MethodBadge` | CVA + `<span>` | `Chip` / `Badge` (`@heroui/react`) | Use HeroUI `Chip` for status chips & HTTP method indicators (`GET`, `POST`, `PUT`, `DELETE`). |
| `CardSection` | Custom `<div>` wrapper | `Card` (`@heroui/react`) | Re-implement with HeroUI `Card` (`Card.Header`, `Card.Content`). |
| `Tooltip` | `@radix-ui/react-tooltip` | `Tooltip` (`@heroui/react`) | Wrap HeroUI `Tooltip` with trigger and overlay content. |
| `Toaster` | Custom `useUiStore` toasts | HeroUI `Toast` / keep custom | Preserve `useUiStore` toast API, style notifications with HeroUI surface & alert tokens. |

---

## 3. Phased Implementation Plan

### Phase 1 — Environment, Dependencies & Theming
- [x] Install HeroUI v3 packages:
  ```bash
  npm i @heroui/react @heroui/styles tailwind-variants
  ```
- [x] Update `src/app/theme.css`:
  - Import `@heroui/styles` directly after `@import "tailwindcss";`.
  - Wire dark mode variables adhering to [`DESIGN.md`](../DESIGN.md).
  - Ensure `#root` and `body` carry `class="dark"` / `data-theme="dark"` and `bg-background text-foreground`.
- [x] Verify test harness compatibility:
  - Ensure Vitest / JSDOM environment resolves HeroUI styles and React Aria components without warnings.

### Phase 2 — Core UI Primitives Migration (`src/components/ui/`)
- [x] **`button.tsx`**:
  - Replace CVA with HeroUI `Button`.
  - Preserve variant signatures: `primary`, `secondary`, `ghost`, `danger`.
  - Ensure compatibility with both `onClick` and `onPress`.
- [x] **`input.tsx` & `buffered-input.tsx`**:
  - Migrate to HeroUI `Input`.
  - Ensure focus rings, placeholder contrast, and debounce logic in `BufferedInput` remain intact.
- [x] **`switch.tsx` & `checkbox.tsx`**:
  - Replace Radix Switch with HeroUI `Switch`.
  - Update `Checkbox` with accessible HeroUI Checkbox.
- [x] **`badge.tsx` & `method-badge.tsx`**:
  - Implement using HeroUI `Chip` with semantic color variants.
  - Verify `method-badge.test.tsx` passes.
- [x] **`card-section.tsx` & `form-row.tsx`**:
  - Re-implement `CardSection` using HeroUI `Card`.
  - Ensure `FormRow` and `ToggleRow` maintain exact labels, hints, and accessibility links (`htmlFor`).
- [x] **`dialog.tsx` & `confirm-delete-dialog.tsx`**:
  - Re-implement using HeroUI `Modal`.
  - Verify `confirm-delete-dialog.test.tsx` passes.
- [x] **`tooltip.tsx`**:
  - Re-implement using HeroUI `Tooltip`.
- [x] **Verification**:
  - Run all primitive unit tests (`src/components/ui/*.test.tsx`).

### Phase 3 — Feature & Screen Migration
- [x] **Model Designer (`src/features/designer/`)**:
  - Primitives consumed by `EntityHeader`, `EntityOptionsCard`, `EntitySearchSortCard`, `EntityOwnershipCard`, `EntityPerformanceCard`.
  - Verified with `EntityDetail.test.tsx`, `FieldsEditor.test.tsx`, `RelationsEditor.test.tsx`, `CustomEndpointsEditor.test.tsx`.
- [x] **Settings Screen (`src/features/settings/`)**:
  - Primitives consumed by database, auth, storage, multitenancy, and rate limit cards.
  - Verified with `SettingsScreen.test.tsx`.
- [x] **Auth & Access Matrix (`src/features/auth/`)**:
  - Primitives consumed by `AuthSettingsPanel` and `AccessMatrix` table/switches.
  - Verified with `AuthSettingsPanel.test.tsx` and `AccessMatrix.test.tsx`.
- [x] **Endpoints Review (`src/features/endpoints/`)**:
  - Primitives consumed by `EndpointsScreen` method badges, filter inputs, and route table.
  - Verified with `EndpointsScreen.test.tsx`.
- [x] **Preview & Export (`src/features/preview/`)**:
  - Primitives consumed by `PreviewScreen`, `ExportDialog`, and `DiffViewer`.
  - Verified with `PreviewScreen.test.tsx`, `ExportDialog.test.tsx`, `DiffViewer.test.tsx`.
- [x] **App Shell & Modals (`src/app/`)**:
  - Primitives consumed by `Header`, `Sidebar`, `ShortcutsModal`, `ProjectModal`.
  - Verified with `App.test.tsx`, `DesignerScreens.test.tsx`, `StudioPolish.test.tsx`.

### Phase 4 — Dependency Pruning & Cleanup
- [x] Remove superseded dependencies:
  ```bash
  npm uninstall @radix-ui/react-dialog @radix-ui/react-scroll-area @radix-ui/react-switch @radix-ui/react-tooltip class-variance-authority
  ```
- [x] Clean up redundant CSS classes and unused helpers in `src/components/ui/`.
- [x] Verify package bundle size and check that no dead code remains.

### Phase 5 — Full Verification & Acceptance
- [x] Run full test suite: `npm test` (all 53 suites, 443+ tests must pass).
- [x] Run TypeScript check: `npm run typecheck`.
- [x] Run production build: `npm run build`.
- [x] Run golden output verification: `npm run verify:output`.
- [ ] Manual desktop smoke checklist (Tauri window bounds, modal dismissal, keyboard shortcuts, undo/redo).

---

## 4. Definition of Done
1. All UI primitives in `src/components/ui/` use HeroUI v3 components.
2. Radix UI packages removed from `package.json`.
3. 100% of automated tests pass without skipping or disabled assertions.
4. Production build produces clean bundles with no type or lint errors.
5. Visual presentation adheres to `DESIGN.md` dark theme tokens.

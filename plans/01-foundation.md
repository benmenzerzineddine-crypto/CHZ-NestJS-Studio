# Step 01 — Foundation (M0)

**Goal:** turn the Tauri starter into a working studio shell that can create,
edit, save, reopen and delete projects, with the domain model and state layer in
place.

- **Depends on:** nothing
- **Plan reference:** `plan.md` §3, §4
- **Next step:** [`02-model-designer.md`](02-model-designer.md)

---

## Scope

**In:** dependencies, app shell/navigation, Zod project model, Zustand store with
undo/redo, autosave, Tauri project persistence, projects screen, `write_files`
command skeleton.

**Out:** entity/field editors, validation rules, any code generation.

---

## Tasks

### 1.1 Install and configure dependencies

- [x] Runtime: `zustand`, `zod`, `nanoid`, `pluralize`, `clsx`, `tailwind-merge`,
      `lucide-react`, `@monaco-editor/react`, `fflate`, `prettier`,
      `class-variance-authority`, Radix primitives (`dialog`, `dropdown-menu`,
      `select`, `tabs`, `switch`, `tooltip`, `separator`, `scroll-area`).
- [x] Dev: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
      `@types/pluralize`, `tailwindcss`, `@tailwindcss/vite`.
- [x] `vite.config.ts`: add Tailwind plugin, `@` → `src` alias, Vitest config
      (`environment: 'jsdom'`, `setupFiles`).
- [x] `tsconfig.json`: add `paths` for `@/*`.
- [x] `src/test/setup.ts` with jest-dom matchers.
- [x] Remove the template demo: `greet` command in `src-tauri/src/lib.rs`,
      `src/App.tsx` greet UI, `src/assets/*`, unused svg files.

**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `src/test/setup.ts`

### 1.2 App shell and theme

- [x] `src/app/App.tsx`: sidebar navigation with **Projects, Settings, Entities,
      Auth, Endpoints, Generate** + footer showing project name, save state
      (saved / saving / unsaved), undo/redo buttons.
- [x] `src/app/theme.css`: CSS variables, dark theme default, layout primitives.
- [x] `src/components/ui/*`: minimal Button, Input, Select, Dialog, Switch, Tabs,
      Badge, ScrollArea, Tooltip built on Radix + CVA.
- [x] Placeholder screens for every route (real implementations land in later steps).
- [x] `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+S` (flush autosave) handlers.

**Files:** `src/app/*`, `src/components/ui/*`, `src/main.tsx`

### 1.3 Domain model (Zod)

- [x] `src/core/model/schema.ts`: implement every type from `plan.md` §4 —
      `Driver`, `Operation`, `AccessRule`, `AuthConfig`, `Project`, `EntityDef`,
      `FieldDef`, `FieldType`, `RelationDef`, `RelationKind`, `EnumDef`.
- [x] `src/core/model/defaults.ts`:
  - `createProject(name, driver, authEnabled)` with npm settings, `/api` prefix,
    swagger/docker/tests on.
  - `createEntity(name)` with default access matrix (plan §4 table).
  - `createField(name, type)` and per-type column defaults.
  - `defaultAuth()` with roles `admin` + `user`.
  - `RESERVED_ENTITY_NAMES = ['User', 'RefreshToken', 'Auth']` and
    `buildUserEntity()` as a built-in, non-deletable entity.
- [x] `schemaVersion: 1` present on every project; a `migrateProject(raw)` stub
      that rejects unknown future versions with a clear error.
- [x] Unit tests: factories produce valid projects; unknown fields rejected;
      missing access rules rejected.

**Files:** `src/core/model/schema.ts`, `src/core/model/defaults.ts`,
`src/core/model/*.test.ts`

### 1.4 Store, undo/redo, autosave

- [x] `src/store/project.store.ts`: `project | null`, `dirty`, `lastSavedAt`,
      `status`, actions `createProject`, `openProject`, `closeProject`,
      `updateProject(fn)`, `setScreen`.
- [x] `zundo` temporal middleware, 100-step limit, actions excluded from history
      except model mutations.
- [x] `src/store/autosave.ts`: 800ms debounce, flush on window blur/close,
      calls `saveProject`; skip if `!dirty`.
- [x] `src/store/ui.store.ts`: active screen, selected entity, toast queue.
- [x] Tests for create → mutate → undo → redo → dirty transitions.

**Files:** `src/store/*`

### 1.5 Tauri persistence + typed bridge

- [x] `src-tauri/Cargo.toml`: add `tauri-plugin-dialog`; keep `serde`, `serde_json`.
- [x] `src-tauri/src/commands/projects.rs`:
      `save_project(project)`, `load_project(id)`, `list_projects()`,
      `delete_project(id)`. Storage: `<app_data_dir>/chz-nest/projects/<id>.json`,
      atomic temp-file + rename, `index.json` cache with name/driver/updatedAt.
- [x] `src-tauri/src/commands/files.rs` (skeleton used fully in M3):
      `write_files(root, files[{path, content, strategy}])` with path-traversal
      guard, directory creation, atomic writes, per-file results.
- [x] `src-tauri/src/lib.rs`: register dialog plugin + commands, remove `greet`.
- [x] `src/lib/tauri.ts`: typed wrappers (`invoke` + normalized `AppError`).
- [x] Rust unit test for the path guard (reject `../` and absolute paths).

**Files:** `src-tauri/Cargo.toml`, `src-tauri/src/**`, `src/lib/tauri.ts`

### 1.6 Projects screen

- [x] Project cards: name, driver, entity count, last updated, delete action.
- [x] New-project dialog: name, auto-slugged package name, driver select,
      auth toggle (default on). Creates project + opens it.
- [x] Open project loads JSON, runs `migrateProject`, hydrates store.
- [x] Delete with confirmation; empty state with a primary CTA.
- [x] Recent list sorted by `updatedAt`, derived from Rust.

**Files:** `src/features/projects/*`

### 1.7 Verification

- [x] `npm test` green.
- [x] `npm run build` green (no TS errors).
- [x] `cd src-tauri && cargo check` green.
- [ ] `npm run tauri dev` → create project → set name → quit → relaunch → project
      is listed with its name and driver. **(manual desktop check pending)**

---

## Definition of done

1. A project can be created, modified, autosaved, reopened and deleted.
2. Undo/redo affects model changes only.
3. No template/demo code remains.
4. `write_files` exists and refuses paths escaping the target root.
5. The six screens render with placeholders; navigation state lives in the store.

---

## Notes / risks

- Vite 8 + TS 6 are new; pin working versions in `package.json` rather than using
  `latest` for anything that breaks.
- Keep `src/core` free of React and Tauri imports — tests and the future CLI rely on it.
- Autosave failures must surface as a toast and keep `dirty = true`.

---

## Implementation notes (2026-10-23)

- **Done:** every task above except the manual desktop smoke check.
- **Project listing** scans `projects/*.json` instead of maintaining an
  `index.json` cache. With local project counts this is simpler and cannot go stale.
- **Reveal in file manager** is deferred to M3; it will use `revealItemInDir`
  from `tauri-plugin-opener` (already installed).
- **Settings screen** is implemented (not a placeholder) so project name, package,
  driver and feature flags are editable in M0.
- **Identifier inputs are sanitized** (package name / API prefix) and fall back to
  safe defaults on blur, so an autosaved project always reopens.
- **Extra tests:** store undo/redo/autosave/close lifecycle and an App render
  smoke test.
- **Checks run:** `npm test` (30 tests), `npm run build`, `cargo check`,
  `cargo test` (4 tests).
- **Known:** `npm audit` reports a DOMPurify advisory pulled in by Monaco. The
  editor is not used until M2; apply `npm audit fix` when wiring it up.

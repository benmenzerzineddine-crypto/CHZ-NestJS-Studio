# Step 15 — Diff Preview (M5i)

**Goal:** Provide a visual before/after diff preview in the Studio's Code Preview screen (`src/features/preview/`), enabling developers to inspect line-by-line additions, deletions, and modifications between generation runs or against previously exported project code using Monaco's native `DiffEditor`.

- **Depends on:** [`14-ui-component-refactor.md`](14-ui-component-refactor.md) (M5h accepted)
- **Plan reference:** `plan.md` §2, §5; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- **Store Extensions (`src/store/generate.store.ts`):**
  - Store `previousResult: GenerateResult | null` alongside `result` when regenerating a project.
  - Track `viewMode: 'code' | 'diff'` in generate or UI state.
  - Provide helper `getFileDiff(path: string): { original: string | null; modified: string; status: 'added' | 'modified' | 'unchanged' }`.
- **Monaco Diff Viewer Component (`src/features/preview/DiffViewer.tsx`):**
  - Lazy-load `DiffEditor` from `@monaco-editor/react`.
  - Consistent typography, padding, language detection, and dark theme (`vs-dark`) matching [`CodeViewer.tsx`](../src/features/preview/CodeViewer.tsx).
  - Support side-by-side vs inline diff layout toggle.
  - Informative banner when a file is newly added (`Added in this revision`) or unchanged (`Identical to previous generation`).
- **File Tree Diff Badges (`src/features/preview/FileTreeView.tsx`):**
  - Display subtle visual status indicators on files in the tree view:
    - `+` (green / success) for newly added files.
    - `~` (amber / warning) for modified files.
  - Summary chip in the file tree header showing diff stats (e.g. `2 modified, 1 added`).
- **Preview Screen Controls (`src/features/preview/PreviewScreen.tsx`):**
  - Segmented view mode control (`Code` / `Diff`) in the code toolbar next to Copy and File info.
  - Seamless toggle between regular monaco `CodeViewer` and `DiffViewer`.
  - Diff mode disabled with tooltip when no previous generation exists yet (first run).
- **Testing & Verification:**
  - Unit tests for diff calculation logic in `generate.store.test.ts`.
  - Component tests for `DiffViewer.test.tsx` and updated `PreviewScreen.test.tsx`.
  - Full test suite passes (`npm test`).
  - Production build clean (`npm run build`).

**Out:**
- Git repository commit staging (this diff is an in-memory generation preview prior to disk export).
- Arbitrary multi-project external file comparisons.

---

## Tasks

### 15.1 Store Extensions & Diff Tracking
- [x] Add `previousResult: GenerateResult | null` and `viewMode: 'code' | 'diff'` to `GenerateStore` in `src/store/generate.store.ts`.
- [x] Preserve current `result` as `previousResult` prior to replacing it upon subsequent generation runs.
- [x] Implement `getFileDiff(path: string)` helper returning `status`, `original`, and `modified` content.
- [x] Add tests in `src/store/generate.store.test.ts`.

### 15.2 Monaco DiffViewer Component
- [x] Create `src/features/preview/DiffViewer.tsx` wrapping `@monaco-editor/react`'s `DiffEditor`.
- [x] Handle added, modified, and unchanged states gracefully with banners/fallback view.
- [x] Add unit test in `src/features/preview/DiffViewer.test.tsx`.

### 15.3 File Tree Diff Indicators
- [x] Update `src/features/preview/FileTreeView.tsx` to display `added` and `modified` indicators on file tree items when diff data is available.
- [x] Add change summary badge in the file tree header.

### 15.4 PreviewScreen Integration
- [x] Add `Code` / `Diff` segmented toggle button to `src/features/preview/PreviewScreen.tsx`.
- [x] Wire up `DiffViewer` rendering when `viewMode === 'diff'`.
- [x] Update `src/features/preview/PreviewScreen.test.tsx` to verify view mode switching.

### 15.5 Verification & Regression Testing
- [x] Run full test suite: `npm test`.
- [x] Run production build: `npm run build`.
- [x] Update documentation and mark tasks completed in `plans/README.md`.

---

## Acceptance Criteria

1. **Intuitive Diff Experience:**
   - On the first generation run, `Diff` toggle shows a tooltip indicating no previous generation exists yet.
   - When project settings or entities are edited and regenerated, the previous generation is retained as the diff baseline.
   - Users can toggle between full `Code` view and side-by-side/inline `Diff` view with one click.
2. **Clear Tree Insights:**
   - Modified and newly added files are immediately recognizable in the file tree sidebar with subtle color-coded indicators.
3. **Automated Verification:**
   - 100% test pass rate across the full test suite (`npm test`).
   - Clean production bundle build (`npm run build`).

---

## Verification Commands

```bash
# Run tests
npm test src/store/generate.store.test.ts
npm test src/features/preview

# Run all tests
npm test

# Verify production build
npm run build
```

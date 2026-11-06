# Step 08 — Standalone CLI

**Goal:** generate a NestJS project from a saved model with one command, in CI or
on a machine without the desktop app, reusing the exact same `src/core` pipeline
as the studio so both produce byte-identical output.

- **Depends on:** [`07-docker-verification.md`](07-docker-verification.md) (M5a accepted)
- **Plan reference:** `plan.md` §7, §8, §9, §12

---

## Scope

**In:** a `generate` and a `validate` command over a project JSON file, the same
three-way manifest export policy as the studio, a safe default for local edits,
path guards, exit codes and documented npm scripts. Pure argument/report logic
lives in `src/core/cli/` behind unit tests; file I/O lives in `src/cli/`.

**Out:** publishing the package to npm, a `bin` installer, watch mode, model
editing, template overrides, database introspection, and running Docker. The CLI
never touches `src-tauri` and adds no runtime dependency.

---

## Command surface

```bash
npm run chz -- validate src/core/fixtures/blog.json
npm run chz -- generate src/core/fixtures/blog.json --out .tmp/blog-api
npm run chz -- generate src/core/fixtures/blog.json --out .tmp/blog-api --dry-run
npm run chz -- generate src/core/fixtures/blog.json --out .tmp/blog-api --overwrite
```

| Flag | Meaning |
| --- | --- |
| `--out <dir>` | Target folder. Defaults to `./<packageName>` in the current directory. |
| `--dry-run` | Print the export plan, write nothing. |
| `--overwrite` | Overwrite `disk-modified` and `untracked` files instead of skipping them. |
| `--raw` | Skip Prettier (fast preview output, not meant for exporting). |
| `--json` | Machine-readable report on stdout. |

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Success (conflicts may have been skipped; they are reported) |
| `1` | Usage error (bad flag, missing file) |
| `2` | The model failed schema parsing or validation; zero files written |
| `3` | Writing files or the manifest failed |

---

## Tasks

- [x] Add `src/core/cli/args.ts`: pure argv parser for `generate` / `validate`
      with typed options, `--help`, and unknown-flag rejection. Tests in
      `args.test.ts`.
- [x] Add `src/core/cli/paths.ts`: `assertSafeRelativePath` rejecting absolute
      paths, drive letters, `..` segments and empty segments. Tests.
- [x] Add `src/core/cli/actions.ts`: map a CLI conflict policy (`safe` default)
      onto `ConflictAction` records for a built `ExportPlan`, plus the counts and
      the human report lines. Tests.
- [x] Add `src/cli/index.ts`: the Node runner — read the JSON, `migrateProject`,
      `validateProject`, `generateProject`, scan the target folder, build the
      plan, write atomically, update `chz-nest.json`. No domain logic.
- [x] Add the `chz` npm script; document the command in `AGENTS.md` §Commands and
      `plan.md` §10.
- [x] Keep `src/core` pure: no `node:` imports outside `src/cli/`.
- [x] Update `plan.md` §9 with an M5b row and drop the CLI line from §12.

---

## Definition of done

1. `validate` on the `blog` fixture exits `0` and prints zero issues.
2. `generate` writes the same file set and contents as
   `generateProject(blogFixture)`; a test proves it.
3. A second `generate` into the same folder skips unchanged files and writes
   nothing new.
4. After editing a generated file by hand, `generate` leaves it untouched and
   reports it as a conflict; `--overwrite` replaces it.
5. An invalid model exits `2` and writes zero files.
6. `npm test` and `npm run build` stay green, and `src/core` still compiles
   without Node APIs.

---

## Verification

```bash
npm test
npm run build
npm run chz -- validate src/core/fixtures/blog.json
npm run chz -- generate src/core/fixtures/blog.json --out .tmp/cli-blog --dry-run
npm run chz -- generate src/core/fixtures/blog.json --out .tmp/cli-blog
npm run chz -- generate src/core/fixtures/blog.json --out .tmp/cli-blog
```

---

## Risks

| Risk | Mitigation |
| --- | --- |
| CLI and studio drift | Both call `generateProject`; a test compares CLI output to its result |
| Silent overwrite of local edits | Default is skip; `--overwrite` is explicit and reported |
| Path escape through generated paths | `assertSafeRelativePath` on every write, plus generated paths are never absolute |
| Determinism | No timestamps in file contents; only `chz-nest.json` records `createdAt`, exactly like the studio |
| Core purity regression | A test asserts `src/core` imports no `node:` modules |

---

## Verification log

- 2026-11-04 — Implemented. `src/core/cli/` holds the pure parser, path guard and
  plan/conflict reporting (36 tests). `src/cli/run.ts` does the file I/O and
  `src/cli/index.ts` is a thin entry point so the runner is testable without
  spawning a process. `src/cli/run.test.ts` (node environment) proves the CLI
  writes exactly the files `generateProject` produces, that a second run skips
  everything, that a hand-edited file is kept and reported until `--overwrite`,
  that an invalid model exits `2` without creating files, and that `--json` is
  parseable. `src/core/purity.test.ts` fails the build if a `node:` import ever
  appears in `src/core`.
  Verified: `npm test` (33 files / 303 tests), `npm run build`, `npm run chz --
  validate src/core/fixtures/blog.json` → `0 errors, 0 warnings`, dry run → `84
  new`, first generate → `84 written`, second → `0 written, 84 skipped`, edited
  `src/main.ts` → conflict skipped, `--overwrite` → restored, invalid model →
  exit `2` and no folder, `--raw` → unformatted output.

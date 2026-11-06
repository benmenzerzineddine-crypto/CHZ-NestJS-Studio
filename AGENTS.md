# AGENTS.md

Instructions for AI agents working in this repository.

## Project

**chz-nest** — a desktop low-code studio (Tauri 2 + React 19 + TypeScript) for
designing a data model and exporting a runnable **NestJS + TypeORM** REST API
with JWT authentication and role/ownership authorization.

This repository contains the **generator app**. Generated NestJS projects are
output artifacts — they are never committed here.

## Read before changing anything

1. `plan.md` — locked decisions, architecture, project model, auth design,
   generator pipeline, export/overwrite policy.
2. `plans/README.md` — milestone order and status.
3. The current milestone file (`plans/0X-*.md`) — tasks, files, DoD.

Work on **one milestone at a time**. Do not start a milestone until the previous
one's definition of done is satisfied.

## Workflow

- Implement tasks in order within the current milestone; tick checkboxes as you go.
- Keep each change scoped to the current task. No speculative features.
- If a decision changes: update `plan.md` first, then the affected step file(s).
- Update the status table in `plans/README.md` when a milestone starts or finishes.
- Do not mark a task done without running its verification.
- When reporting back: what changed, what was verified, and any deviation from the plan.

## Architecture boundaries

| Area | Rule |
| --- | --- |
| `src/core/` | Pure TypeScript. No React, no Tauri, no DOM APIs (Web Crypto is allowed). Must stay reusable by a future CLI. |
| `src/features/` | UI and feature logic. Reads/writes project state through store actions only. |
| `src/app/` | Shell, navigation, theme, global handlers. |
| `src/components/ui/` | Local design-system primitives (Radix + Tailwind + CVA). |
| `src/store/` | Zustand slices. Every project mutation goes through an action so undo/redo and autosave work. |
| `src-tauri/` | Thin I/O only: app-data persistence, file writes, folder reveal. No domain logic. |
| `src/core/emit/` | Pure emitters `(ir) => GeneratedFile[]`. No I/O, no `Date.now()`, no randomness. |
| `src/cli/` | Node-only CLI runner. Filesystem I/O only; every decision lives in `src/core/cli/`. |

- All emitted imports must go through the import registry, never hand-written per emitter.
- Never call the generator without a clean `validateProject` result.
- Relation normalization lives in `src/core/model/normalize.ts`; the UI and the
  generator consume the same canonical shape.

## Conventions

- TypeScript strict. **No `any`**, no `@ts-ignore` without a comment explaining why.
  Parse external data with Zod instead of casting.
- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components,
  `*.store.ts` for stores, `*.test.ts` next to the code under test.
- Naming: entities `PascalCase` singular; fields/relations `camelCase`;
  DB tables/columns `snake_case`; REST paths kebab/plural.
- Exported functions get explicit return types. Prefer named exports except for
  React components that are default-exported by convention.
- Zustand actions are named `verbNoun` (`addEntity`, `renameField`) and are the
  only place project state changes.
- Styling: Tailwind utilities + theme tokens. No inline styles except computed
  values. Reuse `src/components/ui/*` before adding new primitives.
- Comments only for non-obvious decisions; no narrating the code.
- Errors: normalize Tauri errors in `src/lib/tauri.ts`; surface them to the user
  through toasts with a copyable detail.

## UI & Design System (HeroUI v3)

Follow [DESIGN.md](./DESIGN.md) for all visual and interaction decisions.
- **HeroUI LLMs reference**:
  - Compact index: https://heroui.com/react/llms.txt
  - Full documentation: https://heroui.com/react/llms-full.txt
  - Component API docs: https://heroui.com/react/llms-components.txt
- **Local documentation & demos**: Located in `.heroui-docs/react/`
- **Agent Skill**: Installed at `.agents/skills/heroui-react` (mirrored in `.cursor/skills/heroui-react`, `.claude/skills/heroui-react`, `.opencode/skills/heroui-react`)
- **MCP Server**: `@heroui/react-mcp` configured in `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, and `opencode.json`. Exposes tools: `list_components`, `get_component_docs`, `get_component_source_code`, `get_component_source_styles`, `get_theme_variables`, `get_docs`.

## Testing

- Vitest for everything; Testing Library only for store/validation-adjacent UI.
- New logic in `src/core` requires unit tests. Every validation rule gets a test.
- Snapshot updates are intentional and reviewed — never blind-update to make CI pass.
- Snapshots must be deterministic: no timestamps, generated ids, or absolute paths.
- The golden-output script (`scripts/verify-output.mjs`) installs and builds the
  generated app; run it manually or in CI, not as part of the fast test suite.
- Generated API e2e (Jest + Supertest) must cover auth (401/refresh) and
  authorization (403/owner isolation) whenever those features are touched.

## Security invariants

- `passwordHash` is `select: false` in TypeORM **and** `@Exclude()` in the entity.
- Roles and passwords are never fields on generic entity DTOs; they go through
  dedicated endpoints (`change-password`, `PATCH /users/:id/roles`).
- Ownership is enforced in generated services via `applyAccessScope`; foreign rows
  return **404**, not 403, to avoid existence leaks.
- The last admin cannot be deleted or demoted; users cannot change their own roles.
- `write_files` rejects absolute paths and `..` traversal, and never deletes files
  missing from the manifest.
- Generated `main.ts` refuses to boot in production with default JWT secrets.
- No secrets, tokens, or real credentials in fixtures, snapshots, or docs.

## Commands

```bash
npm run dev                 # Vite dev server
npm run build               # tsc + vite build
npm test                    # Vitest (added in M0)
npm run tauri dev           # desktop app
cd src-tauri && cargo check # Rust compile check

# after M2 — verify generated output end-to-end
node scripts/verify-output.mjs --fixture blog --driver sqlite

# after M4 — generate, build and smoke-test the compose stack
npm run verify:docker
npm run verify:docker:postgres

# after M5b — generate from a saved model without the desktop app
npm run chz -- validate <project.json>
npm run chz -- generate <project.json> --out <dir>
```

Generated project (from an exported folder):

```bash
npm install && npm run build
npm run test:e2e
```

## Do not

- Introduce an ORM adapter abstraction, Prisma/Drizzle support, or an ERD canvas
  before M5.
- Add `tauri-plugin-fs`; use the custom Rust commands instead.
- Write generated output into this repository.
- Silently change a locked decision in `plan.md`.
- Add auth exemptions to generated write endpoints without an access rule.
- Log user tokens, password hashes, or JWT secrets.
- Reformat or refactor files unrelated to the current task.

## Definition of done for any change

1. The milestone's verification commands pass.
2. New core logic has tests; invalid models still produce zero files.
3. TypeScript and Rust compile cleanly.
4. Checkboxes and `plans/README.md` status are updated.
5. No unrelated diffs.

## Current state

- **2026-10-23** — M0 foundation implemented: project model (Zod), Zustand store
  with undo/redo and autosave, Tauri project persistence + path-guarded
  `write_files`, app shell and projects/settings screens. Automated checks green
  (`npm test`, `npm run build`, `cargo check`, `cargo test`). M0's manual
  desktop smoke check is still pending.
- **2026-10-23** — M1 model designer implemented: entity/field/enum/relation
  editors, derived inverses and `normalize.ts`, semantic validation with a
  navigable sidebar panel, auth settings and roles, per-entity access matrix
  with managed owner relations, read-only endpoint review, and the `blog` fixture
  (zero validation issues). `npm test` (95 tests) and `npm run build` are green.
  M1 manual desktop checks are still pending.
- **2026-10-23** — M2 generator implemented: IR/naming/imports/type map,
  Prettier formatting, scaffold/config/common/entity/DTO/service/controller/
  users/auth emitters, async `generateProject` with zero files on errors,
  Monaco preview with stale detection, ZIP export with a hashed manifest, and
  `scripts/verify-output.mjs`. `npm test` (158 tests), `npm run build`,
  `cargo check`, and SQLite golden install/build/boot/health plus auth/CRUD smoke
  checks are green; Postgres and MySQL generated builds pass. Desktop preview/ZIP
  smoke checks are still pending.
- **2026-10-25** — M3 authorization and disk export implemented: access-matrix
  decorator tests, cascading indexed owner FKs, owner scoping with 404 isolation,
  `PATCH /users/me`, inactive refresh/login rejection, generated auth and
  authorization e2e suites, Rust `read_manifest` with SHA-256, pure export
  planning with conflict actions, folder export dialog, and last-export path
  tracking. `npm test` (215 tests), `npm run build`, `cargo test` (11 tests),
  generated SQLite and Postgres `npm run test:e2e` (38 tests each), and the SQLite
  golden-output check are green. The manual desktop export matrix is still
  pending.
- **2026-10-28** — Post-M3 hardening pass implemented: three-way export
  classification (generator-updated vs disk-modified vs untracked), manifest
  overrides for skipped edits, requested-path manifest hashing, destination-safe
  atomic writes, parent containment before directory creation, many-to-many
  custom primary keys, nullable date clearing, public logout, refresh-token
  revocation on password change, exact admin counting, extra validation rules,
  Zod-parsed project loading, and constraint-aware generated e2e factories.
  `npm test` (229 tests), `npm run build`, `cargo test` (14 tests), generated
  SQLite/Postgres/m2m e2e (39 tests each), and SQLite/Postgres golden output are
  green. M4 is next.
- **2026-10-31** — Generated list querying improved: string/text filters now use
  contains matching (`ILIKE` on Postgres, `LIKE` elsewhere), and `search` falls
  back to every string/text field when an entity has no explicit search fields.
  Emitter tests cover fallback, explicit fields, deduplication, non-text
  entities, and per-driver operators. `npm test` (236 tests) and `npm run build`
  are green; a freshly generated project passes `tsc --noEmit`. M4 remains next.
- **2026-11-01** — M4 depth/hardening implemented: typed query DTO filters,
  ranges, whitelisted sort with `-field` syntax, pagination meta envelopes,
  soft delete/restore with admin-only `withDeleted`, deterministic seeds with
  `--reset`, full Swagger schemas/bearer docs, hardened Docker build + compose
  with migrations/seed entrypoint flags, per-entity CRUD e2e specs, shared test
  helpers, and studio polish (copyable toast details, unsaved guard, header
  validation badge, shortcuts, remembered window bounds, lazy Generate screen,
  fast raw preview + background Prettier formatting, and format/generation
  memoization). `npm test` (259 tests), `npm run build`,
  generated SQLite and Postgres `npm run test:e2e` (69 each), seed idempotency,
  Swagger docs/login, and Docker compose health/login are green. Raw generation is
  47ms for 10 entities (studio shows it immediately; Prettier runs in the
  background), so the `<300ms` visible-generation target is met. Manual desktop
  checks remain pending.

- **2026-11-01** — M4 accepted and marked done after the user completed the manual
  desktop checklist. Automated baseline remains 28 files / 259 studio tests,
  `npm run build`, `cargo check`, `cargo test` (14), generated SQLite/Postgres
  e2e (69 each), and Docker compose checks. M5 is next.
- **2026-11-03** — M5a one-command Docker verification confirmed: `--docker` /
  `--keep-stack` modes in `scripts/verify-output.mjs`, `DB_HOST_PORT` in generated
  Postgres/MySQL compose, `npm run verify:docker[:postgres|:mysql]` scripts.
  SQLite and Postgres stacks both reach health 200, admin login and seed rows,
  then tear down. `npm test` (259) green.
- **2026-11-04** — M5b standalone CLI implemented: `src/core/cli/` (argv parser,
  path guard, conflict policy and report lines) plus a Node-only runner in
  `src/cli/` exposed as `npm run chz -- generate|validate`. It reuses
  `generateProject` and the studio's three-way manifest policy, never overwrites
  hand-edited files unless `--overwrite` is passed, and exits `2` with zero files
  on an invalid model. `npm test` (33 files / 303 tests) and `npm run build` are
  green; CLI output is byte-identical to the studio's `generateProject`.


<!-- HEROUI-REACT-AGENTS-MD-START -->
[HeroUI React v3 Docs Index]|root: ./.heroui-docs/react|STOP. What you remember about HeroUI React v3 is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --react --output AGENTS.md|components/(buttons):{button-group.mdx,button.mdx,close-button.mdx,toggle-button-group.mdx,toggle-button.mdx}|components/(collections):{dropdown.mdx,list-box.mdx,tag-group.mdx}|components/(colors):{color-area.mdx,color-field.mdx,color-picker.mdx,color-slider.mdx,color-swatch-picker.mdx,color-swatch.mdx}|components/(controls):{slider.mdx,switch.mdx}|components/(data-display):{badge.mdx,chip.mdx,table.mdx}|components/(date-and-time):{calendar.mdx,date-field.mdx,date-picker.mdx,date-range-picker.mdx,range-calendar.mdx,time-field.mdx}|components/(feedback):{alert.mdx,meter.mdx,progress-bar.mdx,progress-circle.mdx,skeleton.mdx,spinner.mdx}|components/(forms):{checkbox-group.mdx,checkbox.mdx,description.mdx,error-message.mdx,field-error.mdx,fieldset.mdx,form.mdx,input-group.mdx,input-otp.mdx,input.mdx,label.mdx,number-field.mdx,radio-group.mdx,search-field.mdx,text-area.mdx,text-field.mdx}|components/(layout):{card.mdx,separator.mdx,surface.mdx,toolbar.mdx}|components/(media):{avatar-group.mdx,avatar.mdx}|components/(navigation):{accordion.mdx,breadcrumbs.mdx,disclosure-group.mdx,disclosure.mdx,link.mdx,pagination.mdx,tabs.mdx}|components/(overlays):{alert-dialog.mdx,drawer.mdx,modal.mdx,popover.mdx,sheet.mdx,toast.mdx,tooltip.mdx}|components/(pickers):{autocomplete.mdx,combo-box.mdx,select.mdx}|components/(typography):{kbd.mdx,typography.mdx}|components/(utilities):{scroll-shadow.mdx}|getting-started/(handbook):{animation.mdx,colors.mdx,composition.mdx,dark-mode.mdx,styling.mdx,theming.mdx}|getting-started/(overview):{cli.mdx,design-principles.mdx,frameworks.mdx,quick-start.mdx}|getting-started/(ui-for-agents):{agent-skills.mdx,agents-md.mdx,design-md.mdx,llms-txt.mdx,mcp-server.mdx}|releases:{v3-0-0-alpha-32.mdx,v3-0-0-alpha-33.mdx,v3-0-0-alpha-34.mdx,v3-0-0-alpha-35.mdx,v3-0-0-beta-1.mdx,v3-0-0-beta-2.mdx,v3-0-0-beta-3.mdx,v3-0-0-beta-4.mdx,v3-0-0-beta-6.mdx,v3-0-0-beta-7.mdx,v3-0-0-beta-8.mdx,v3-0-0-rc-1.mdx,v3-0-0.mdx,v3-0-2.mdx,v3-0-3.mdx,v3-0-4.mdx,v3-0-5.mdx,v3-1-0.mdx,v3-2-0.mdx,v3-2-1.mdx,v3-2-2.mdx,v3-2-3.mdx,v3-2-4.mdx,v3-2-5.mdx,v3-2-6.mdx,v3-2-7.mdx}|demos/cn/accordion:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,disabled.tsx,faq.tsx,multiple.tsx,render-function.tsx,surface.tsx,without-separator.tsx}|demos/cn/alert-dialog:{backdrop-variants.tsx,close-methods.tsx,controlled.tsx,custom-animations.tsx,custom-backdrop.tsx,custom-icon.tsx,custom-portal.tsx,custom-styles.tsx,custom-trigger.tsx,default.tsx,dismiss-behavior.tsx,placements.tsx,sizes.tsx,statuses.tsx}|demos/cn/alert:{basic.tsx,custom-styles.tsx}|demos/cn/autocomplete:{allows-empty-collection.tsx,asynchronous-filtering.tsx,controlled-multiple.tsx,controlled-open-state.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,custom-value.tsx,default.tsx,disabled.tsx,email-recipients.tsx,full-width.tsx,location-search.tsx,multiple-select.tsx,on-surface.tsx,required.tsx,tag-group-selection.tsx,user-selection-multiple.tsx,user-selection.tsx,variants.tsx,virtualization.tsx,with-description.tsx,with-disabled-options.tsx,with-sections.tsx}|demos/cn/avatar-group:{basic.tsx,count.tsx,custom-styles.tsx,grid.tsx,max.tsx,overlap.tsx,sizes.tsx}|demos/cn/avatar:{basic.tsx,colors.tsx,custom-image-component.tsx,custom-styles.tsx,fallback.tsx,sizes.tsx,variants.tsx}|demos/cn/badge:{basic.tsx,colors.tsx,custom-styles.tsx,dot.tsx,placements.tsx,sizes.tsx,variants.tsx,with-content.tsx}|demos/cn/breadcrumbs:{basic.tsx,custom-separator.tsx,custom-styles.tsx,disabled.tsx,level-2.tsx,level-3.tsx,render-function.tsx}|demos/cn/button-group:{basic.tsx,custom-styles.tsx,disabled.tsx,full-width.tsx,orientation.tsx,sizes.tsx,variants.tsx,with-icons.tsx,without-separator.tsx}|demos/cn/button:{basic.tsx,custom-styles.tsx,custom-variants.tsx,disabled.tsx,full-width.tsx,icon-only.tsx,loading-state.tsx,loading.tsx,release-outline-variant.tsx,render-function.tsx,ripple-effect.tsx,sizes.tsx,social.tsx,variants.tsx,with-icons.tsx}|demos/cn/calendar:{basic.tsx,booking-calendar.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,day-view.tsx,default-value.tsx,disabled.tsx,focused-value.tsx,international-calendar.tsx,min-max-dates.tsx,multiple-months.tsx,multiple-selection.tsx,read-only.tsx,unavailable-dates.tsx,week-view.tsx,weeks-in-month.tsx,with-indicators.tsx,year-picker.tsx}|demos/cn/card:{custom-styles.tsx,default.tsx,horizontal.tsx,variants.tsx,with-avatar.tsx,with-form.tsx,with-images.tsx}|demos/cn/checkbox-group:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,features-and-addons.tsx,indeterminate.tsx,on-surface.tsx,render-function.tsx,validation.tsx,with-custom-indicator.tsx}|demos/cn/checkbox:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,default-selected.tsx,disabled.tsx,external-label.tsx,form.tsx,full-rounded.tsx,indeterminate.tsx,invalid.tsx,render-function.tsx,render-props.tsx,variants.tsx,with-description.tsx}|demos/cn/chip:{basic.tsx,custom-styles.tsx,release-vibrant-palette.tsx,statuses.tsx,variants.tsx,with-icon.tsx}|demos/cn/close-button:{custom-styles.tsx,default.tsx,interactive.tsx,variants.tsx,with-custom-icon.tsx}|demos/cn/color-area:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,render-function.tsx,space-and-channels.tsx,with-dots.tsx}|demos/cn/color-field:{basic.tsx,channel-editing.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,invalid.tsx,on-surface.tsx,render-function.tsx,required.tsx,variants.tsx,with-description.tsx}|demos/cn/color-picker:{basic.tsx,controlled.tsx,custom-styles.tsx,with-fields.tsx,with-sliders.tsx,with-swatches.tsx}|demos/cn/color-slider:{alpha-channel.tsx,basic.tsx,channels.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,render-function.tsx,rgb-channels.tsx,vertical.tsx}|demos/cn/color-swatch-picker:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,default-value.tsx,disabled.tsx,render-function.tsx,sizes.tsx,stack-layout.tsx,variants.tsx}|demos/cn/color-swatch:{accessibility.tsx,basic.tsx,custom-styles.tsx,render-function.tsx,shapes.tsx,sizes.tsx,transparency.tsx}|demos/cn/combo-box:{allows-custom-value.tsx,asynchronous-loading.tsx,controlled-input-value.tsx,controlled.tsx,custom-filtering.tsx,custom-indicator.tsx,custom-styles.tsx,custom-validation.tsx,custom-value.tsx,default-selected-key.tsx,default.tsx,disabled.tsx,form-value.tsx,full-width.tsx,menu-trigger.tsx,multiple-selection.tsx,on-surface.tsx,read-only.tsx,render-function.tsx,required.tsx,validation-behavior.tsx,with-description.tsx,with-disabled-options.tsx,with-sections.tsx}|demos/cn/date-field:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,granularity.tsx,invalid.tsx,on-surface.tsx,render-function.tsx,required.tsx,variants.tsx,with-description.tsx,with-prefix-and-suffix.tsx,with-prefix-icon.tsx,with-suffix-icon.tsx,with-validation.tsx}|demos/cn/date-picker:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,format-options-no-ssr.tsx,format-options.tsx,international-calendar.tsx,render-function.tsx,with-custom-indicator.tsx,with-validation.tsx}|demos/cn/date-range-picker:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,format-options-no-ssr.tsx,format-options.tsx,international-calendar.tsx,release-input-container.tsx,render-function.tsx,with-custom-indicator.tsx,with-validation.tsx}|demos/cn/description:{basic.tsx,custom-styles.tsx}|demos/cn/disclosure-group:{basic.tsx,controlled.tsx,custom-styles.tsx}|demos/cn/disclosure:{basic.tsx,custom-styles.tsx,render-function.tsx}|demos/cn/drawer:{backdrop-variants.tsx,basic.tsx,controlled.tsx,custom-styles.tsx,navigation.tsx,non-dismissable.tsx,placements.tsx,scrollable-content.tsx,with-form.tsx}|demos/cn/dropdown:{controlled-open-state.tsx,controlled.tsx,custom-styles.tsx,custom-trigger.tsx,default.tsx,long-press-trigger.tsx,single-with-custom-indicator.tsx,with-custom-submenu-indicator.tsx,with-descriptions.tsx,with-disabled-items.tsx,with-icons.tsx,with-keyboard-shortcuts.tsx,with-multiple-selection.tsx,with-section-level-selection.tsx,with-sections.tsx,with-single-selection.tsx,with-submenus.tsx}|demos/cn/error-message:{basic.tsx,custom-styles.tsx}|demos/cn/field-error:{basic.tsx,custom-styles.tsx}|demos/cn/fieldset:{basic.tsx,custom-styles.tsx,on-surface.tsx}|demos/cn/form:{basic.tsx,custom-styles.tsx,render-function.tsx}|demos/cn/input-group:{custom-styles.tsx,default.tsx,disabled.tsx,full-width.tsx,invalid.tsx,on-surface.tsx,password-with-toggle.tsx,required.tsx,variants.tsx,with-badge-suffix.tsx,with-copy-suffix.tsx,with-icon-prefix-and-copy-suffix.tsx,with-icon-prefix-and-text-suffix.tsx,with-keyboard-shortcut.tsx,with-loading-suffix.tsx,with-prefix-and-suffix.tsx,with-prefix-icon.tsx,with-suffix-icon.tsx,with-text-prefix.tsx,with-text-suffix.tsx,with-textarea.tsx}|demos/cn/input-otp:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,four-digits.tsx,on-complete.tsx,on-surface.tsx,variants.tsx,with-pattern.tsx,with-validation.tsx}|demos/cn/input:{basic.tsx,controlled.tsx,custom-styles.tsx,full-width.tsx,on-surface.tsx,types.tsx,variants.tsx}|demos/cn/kbd:{basic.tsx,custom-styles.tsx,inline.tsx,instructional.tsx,navigation.tsx,special.tsx,variants.tsx}|demos/cn/label:{basic.tsx,custom-styles.tsx}|demos/cn/link:{basic.tsx,custom-icon.tsx,custom-styles.tsx,icon-placement.tsx,render-function.tsx,underline-and-offset.tsx,underline-offset.tsx,underline-variants.tsx}|demos/cn/list-box:{controlled.tsx,custom-check-icon.tsx,custom-styles.tsx,default.tsx,multi-select.tsx,release-scrollbar-modes.tsx,render-function.tsx,virtualization.tsx,with-disabled-items.tsx,with-sections.tsx}|demos/cn/meter:{basic.tsx,colors.tsx,custom-styles.tsx,custom-value.tsx,sizes.tsx,without-label.tsx}|demos/cn/modal:{backdrop-variants.tsx,close-methods.tsx,controlled.tsx,custom-animations.tsx,custom-backdrop.tsx,custom-portal.tsx,custom-styles.tsx,custom-trigger.tsx,default.tsx,dismiss-behavior.tsx,placements.tsx,scroll-comparison.tsx,sizes.tsx,with-form.tsx}|demos/cn/number-field:{basic.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,on-surface.tsx,render-function.tsx,required.tsx,validation.tsx,variants.tsx,with-chevrons.tsx,with-description.tsx,with-format-options.tsx,with-step.tsx,with-validation.tsx}|demos/cn/pagination:{basic.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,disabled.tsx,simple-prev-next.tsx,sizes.tsx,with-ellipsis.tsx,with-summary.tsx}|demos/cn/popover:{basic.tsx,custom-styles.tsx,interactive.tsx,placement.tsx,render-function.tsx,with-arrow.tsx}|demos/cn/progress-bar:{basic.tsx,colors.tsx,custom-styles.tsx,custom-value.tsx,indeterminate.tsx,sizes.tsx,without-label.tsx}|demos/cn/progress-circle:{basic.tsx,colors.tsx,custom-styles.tsx,custom-svg.tsx,indeterminate.tsx,sizes.tsx,with-label.tsx}|demos/cn/radio-group:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,delivery-and-payment.tsx,disabled.tsx,horizontal.tsx,on-surface.tsx,render-function.tsx,uncontrolled.tsx,validation.tsx,variants.tsx}|demos/cn/range-calendar:{allows-non-contiguous-ranges.tsx,anchor-unavailable-dates.tsx,basic.tsx,booking-calendar.tsx,controlled.tsx,custom-styles.tsx,day-view.tsx,default-value.tsx,disabled.tsx,focused-value.tsx,international-calendar.tsx,invalid.tsx,min-max-dates.tsx,multiple-months.tsx,read-only.tsx,unavailable-dates.tsx,week-view.tsx,weeks-in-month.tsx,with-indicators.tsx,year-picker.tsx}|demos/cn/scroll-shadow:{custom-styles.tsx,default.tsx,hide-scroll-bar.tsx,orientation.tsx,size.tsx,visibility-change.tsx,with-card.tsx}|demos/cn/search-field:{basic.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,on-surface.tsx,render-function.tsx,required.tsx,validation.tsx,variants.tsx,with-description.tsx,with-keyboard-shortcut.tsx,with-validation.tsx}|demos/cn/select:{asynchronous-loading.tsx,controlled-multiple.tsx,controlled-open-state.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,custom-value.tsx,default.tsx,disabled.tsx,full-width.tsx,multiple-select.tsx,on-surface.tsx,render-function.tsx,required.tsx,variants.tsx,with-clear-button.tsx,with-description.tsx,with-disabled-options.tsx,with-sections.tsx}|demos/cn/separator:{basic.tsx,custom-styles.tsx,render-function.tsx,variants.tsx,vertical.tsx,with-content.tsx,with-surface.tsx}|demos/cn/sheet:{backdrop-variants.tsx,basic.tsx,controlled.tsx,detached.tsx,handle-only.tsx,nested.tsx,non-dismissable.tsx,placements.tsx,professions-picker.tsx,scrollable-content.tsx,snap-points-custom-fade.tsx,snap-points-sequential.tsx,snap-points.tsx,with-form.tsx}|demos/cn/skeleton:{animation-types.tsx,basic.tsx,card.tsx,custom-styles.tsx,grid.tsx,list.tsx,single-shimmer.tsx,text-content.tsx,user-profile.tsx}|demos/cn/slider:{controlled.tsx,custom-output.tsx,custom-styles.tsx,custom-value-formatting.tsx,default.tsx,disabled.tsx,range-with-steps-and-marks.tsx,range.tsx,render-function.tsx,vertical-with-steps-and-marks.tsx,vertical.tsx,with-marks.tsx,with-steps-and-marks.tsx,with-steps.tsx}|demos/cn/spinner:{basic.tsx,colors.tsx,custom-styles.tsx,sizes.tsx,speed.tsx}|demos/cn/surface:{basic.tsx,custom-styles.tsx,variants.tsx,with-form-components.tsx}|demos/cn/switch:{basic.tsx,controlled.tsx,custom-styles.tsx,default-selected.tsx,disabled.tsx,form.tsx,group-horizontal.tsx,group.tsx,label-position.tsx,render-function.tsx,render-props.tsx,sizes.tsx,with-description.tsx,with-icons.tsx,without-label.tsx}|demos/cn/table:{async-loading.tsx,basic.tsx,column-resizing.tsx,custom-cells.tsx,custom-styles.tsx,empty-state.tsx,expandable-rows.tsx,pagination.tsx,secondary-variant.tsx,selection.tsx,sorting.tsx,tanstack-table.tsx,virtualization.tsx}|demos/cn/tabs:{basic.tsx,custom-styles.tsx,disabled.tsx,overflow.tsx,render-function.tsx,secondary-vertical.tsx,secondary.tsx,vertical-alignment.tsx,vertical.tsx,with-separator.tsx}|demos/cn/tag-group:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,render-function.tsx,selection-modes.tsx,sizes.tsx,variants.tsx,with-error-message.tsx,with-list-data.tsx,with-prefix.tsx,with-remove-button.tsx}|demos/cn/textarea:{basic.tsx,controlled.tsx,custom-styles.tsx,full-width.tsx,on-surface.tsx,rows.tsx,variants.tsx}|demos/cn/textfield:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,full-width.tsx,input-types.tsx,on-surface.tsx,render-function.tsx,required.tsx,textarea.tsx,validation.tsx,with-description.tsx,with-error.tsx}|demos/cn/time-field:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,invalid.tsx,on-surface.tsx,render-function.tsx,required.tsx,with-description.tsx,with-prefix-and-suffix.tsx,with-prefix-icon.tsx,with-suffix-icon.tsx,with-validation.tsx}|demos/cn/toast:{callbacks.tsx,custom-indicator.tsx,custom-queue.tsx,custom-styles.tsx,custom-toast.tsx,default.tsx,expanded.tsx,placements.tsx,promise.tsx,simple.tsx,variants.tsx}|demos/cn/toggle-button-group:{attached.tsx,basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,full-width.tsx,orientation.tsx,selection-mode.tsx,sizes.tsx,without-separator.tsx}|demos/cn/toggle-button:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,icon-only.tsx,sizes.tsx,variants.tsx}|demos/cn/toolbar:{attached.tsx,basic.tsx,custom-styles.tsx,vertical.tsx,with-button-group.tsx}|demos/cn/tooltip:{basic.tsx,custom-styles.tsx,custom-trigger.tsx,placement.tsx,render-function.tsx,with-arrow.tsx}|demos/cn/typography:{custom-styles.tsx,default.tsx,primitives.tsx,prose.tsx,render-props.tsx,typography-scale.tsx}|demos/en/accordion:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,disabled.tsx,faq.tsx,multiple.tsx,render-function.tsx,surface.tsx,without-separator.tsx}|demos/en/alert-dialog:{backdrop-variants.tsx,close-methods.tsx,controlled.tsx,custom-animations.tsx,custom-backdrop.tsx,custom-icon.tsx,custom-portal.tsx,custom-styles.tsx,custom-trigger.tsx,default.tsx,dismiss-behavior.tsx,placements.tsx,sizes.tsx,statuses.tsx}|demos/en/alert:{basic.tsx,custom-styles.tsx}|demos/en/autocomplete:{allows-empty-collection.tsx,asynchronous-filtering.tsx,controlled-multiple.tsx,controlled-open-state.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,custom-value.tsx,default.tsx,disabled.tsx,email-recipients.tsx,full-width.tsx,location-search.tsx,multiple-select.tsx,on-surface.tsx,required.tsx,tag-group-selection.tsx,user-selection-multiple.tsx,user-selection.tsx,variants.tsx,virtualization.tsx,with-description.tsx,with-disabled-options.tsx,with-sections.tsx}|demos/en/avatar-group:{basic.tsx,count.tsx,custom-styles.tsx,grid.tsx,max.tsx,overlap.tsx,sizes.tsx}|demos/en/avatar:{basic.tsx,colors.tsx,custom-image-component.tsx,custom-styles.tsx,fallback.tsx,sizes.tsx,variants.tsx}|demos/en/badge:{basic.tsx,colors.tsx,custom-styles.tsx,dot.tsx,placements.tsx,sizes.tsx,variants.tsx,with-content.tsx}|demos/en/breadcrumbs:{basic.tsx,custom-separator.tsx,custom-styles.tsx,disabled.tsx,level-2.tsx,level-3.tsx,render-function.tsx}|demos/en/button-group:{basic.tsx,custom-styles.tsx,disabled.tsx,full-width.tsx,orientation.tsx,sizes.tsx,variants.tsx,with-icons.tsx,without-separator.tsx}|demos/en/button:{basic.tsx,custom-styles.tsx,custom-variants.tsx,disabled.tsx,full-width.tsx,icon-only.tsx,loading-state.tsx,loading.tsx,release-outline-variant.tsx,render-function.tsx,ripple-effect.tsx,sizes.tsx,social.tsx,variants.tsx,with-icons.tsx}|demos/en/calendar:{basic.tsx,booking-calendar.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,day-view.tsx,default-value.tsx,disabled.tsx,focused-value.tsx,international-calendar.tsx,min-max-dates.tsx,multiple-months.tsx,multiple-selection.tsx,read-only.tsx,unavailable-dates.tsx,week-view.tsx,weeks-in-month.tsx,with-indicators.tsx,year-picker.tsx}|demos/en/card:{custom-styles.tsx,default.tsx,horizontal.tsx,variants.tsx,with-avatar.tsx,with-form.tsx,with-images.tsx}|demos/en/checkbox-group:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,features-and-addons.tsx,indeterminate.tsx,on-surface.tsx,render-function.tsx,validation.tsx,with-custom-indicator.tsx}|demos/en/checkbox:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,default-selected.tsx,disabled.tsx,external-label.tsx,form.tsx,full-rounded.tsx,indeterminate.tsx,invalid.tsx,render-function.tsx,render-props.tsx,variants.tsx,with-description.tsx}|demos/en/chip:{basic.tsx,custom-styles.tsx,release-vibrant-palette.tsx,statuses.tsx,variants.tsx,with-icon.tsx}|demos/en/close-button:{custom-styles.tsx,default.tsx,interactive.tsx,with-custom-icon.tsx}|demos/en/color-area:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,render-function.tsx,space-and-channels.tsx,with-dots.tsx}|demos/en/color-field:{basic.tsx,channel-editing.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,invalid.tsx,on-surface.tsx,render-function.tsx,required.tsx,variants.tsx,with-description.tsx}|demos/en/color-picker:{basic.tsx,controlled.tsx,custom-styles.tsx,with-fields.tsx,with-sliders.tsx,with-swatches.tsx}|demos/en/color-slider:{alpha-channel.tsx,basic.tsx,channels.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,render-function.tsx,rgb-channels.tsx,vertical.tsx}|demos/en/color-swatch-picker:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,default-value.tsx,disabled.tsx,render-function.tsx,sizes.tsx,stack-layout.tsx,variants.tsx}|demos/en/color-swatch:{accessibility.tsx,basic.tsx,custom-styles.tsx,render-function.tsx,shapes.tsx,sizes.tsx,transparency.tsx}|demos/en/combo-box:{allows-custom-value.tsx,asynchronous-loading.tsx,controlled-input-value.tsx,controlled.tsx,custom-filtering.tsx,custom-indicator.tsx,custom-styles.tsx,custom-validation.tsx,custom-value.tsx,default-selected-key.tsx,default.tsx,disabled.tsx,form-value.tsx,full-width.tsx,menu-trigger.tsx,multiple-selection.tsx,on-surface.tsx,read-only.tsx,render-function.tsx,required.tsx,validation-behavior.tsx,with-description.tsx,with-disabled-options.tsx,with-sections.tsx}|demos/en/date-field:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,granularity.tsx,invalid.tsx,on-surface.tsx,render-function.tsx,required.tsx,variants.tsx,with-description.tsx,with-prefix-and-suffix.tsx,with-prefix-icon.tsx,with-suffix-icon.tsx,with-validation.tsx}|demos/en/date-picker:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,format-options-no-ssr.tsx,format-options.tsx,international-calendar.tsx,render-function.tsx,with-custom-indicator.tsx,with-validation.tsx}|demos/en/date-range-picker:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,format-options-no-ssr.tsx,format-options.tsx,international-calendar.tsx,release-input-container.tsx,render-function.tsx,with-custom-indicator.tsx,with-validation.tsx}|demos/en/description:{basic.tsx,custom-styles.tsx}|demos/en/disclosure-group:{basic.tsx,controlled.tsx,custom-styles.tsx}|demos/en/disclosure:{basic.tsx,custom-styles.tsx,render-function.tsx}|demos/en/drawer:{backdrop-variants.tsx,basic.tsx,controlled.tsx,custom-styles.tsx,navigation.tsx,non-dismissable.tsx,placements.tsx,scrollable-content.tsx,with-form.tsx}|demos/en/dropdown:{controlled-open-state.tsx,controlled.tsx,custom-styles.tsx,custom-trigger.tsx,default.tsx,long-press-trigger.tsx,single-with-custom-indicator.tsx,with-custom-submenu-indicator.tsx,with-descriptions.tsx,with-disabled-items.tsx,with-icons.tsx,with-keyboard-shortcuts.tsx,with-multiple-selection.tsx,with-section-level-selection.tsx,with-sections.tsx,with-single-selection.tsx,with-submenus.tsx}|demos/en/error-message:{basic.tsx,custom-styles.tsx}|demos/en/field-error:{basic.tsx,custom-styles.tsx}|demos/en/fieldset:{basic.tsx,custom-styles.tsx,on-surface.tsx}|demos/en/form:{basic.tsx,custom-styles.tsx,render-function.tsx}|demos/en/input-group:{custom-styles.tsx,default.tsx,disabled.tsx,full-width.tsx,invalid.tsx,on-surface.tsx,password-with-toggle.tsx,required.tsx,variants.tsx,with-badge-suffix.tsx,with-copy-suffix.tsx,with-icon-prefix-and-copy-suffix.tsx,with-icon-prefix-and-text-suffix.tsx,with-keyboard-shortcut.tsx,with-loading-suffix.tsx,with-prefix-and-suffix.tsx,with-prefix-icon.tsx,with-suffix-icon.tsx,with-text-prefix.tsx,with-text-suffix.tsx,with-textarea.tsx}|demos/en/input-otp:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,four-digits.tsx,on-complete.tsx,on-surface.tsx,variants.tsx,with-pattern.tsx,with-validation.tsx}|demos/en/input:{basic.tsx,controlled.tsx,custom-styles.tsx,full-width.tsx,on-surface.tsx,types.tsx,variants.tsx}|demos/en/kbd:{basic.tsx,custom-styles.tsx,inline.tsx,instructional.tsx,navigation.tsx,special.tsx,variants.tsx}|demos/en/label:{basic.tsx,custom-styles.tsx}|demos/en/link:{basic.tsx,custom-icon.tsx,custom-styles.tsx,icon-placement.tsx,render-function.tsx,underline-and-offset.tsx}|demos/en/list-box:{controlled.tsx,custom-check-icon.tsx,custom-styles.tsx,default.tsx,multi-select.tsx,release-scrollbar-modes.tsx,render-function.tsx,virtualization.tsx,with-disabled-items.tsx,with-sections.tsx}|demos/en/meter:{basic.tsx,colors.tsx,custom-styles.tsx,custom-value.tsx,sizes.tsx,without-label.tsx}|demos/en/modal:{backdrop-variants.tsx,close-methods.tsx,controlled.tsx,custom-animations.tsx,custom-backdrop.tsx,custom-portal.tsx,custom-styles.tsx,custom-trigger.tsx,default.tsx,dismiss-behavior.tsx,placements.tsx,scroll-comparison.tsx,sizes.tsx,with-form.tsx}|demos/en/number-field:{basic.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,on-surface.tsx,render-function.tsx,required.tsx,validation.tsx,variants.tsx,with-chevrons.tsx,with-description.tsx,with-format-options.tsx,with-step.tsx,with-validation.tsx}|demos/en/pagination:{basic.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,disabled.tsx,simple-prev-next.tsx,sizes.tsx,with-ellipsis.tsx,with-summary.tsx}|demos/en/popover:{basic.tsx,custom-styles.tsx,interactive.tsx,placement.tsx,render-function.tsx,with-arrow.tsx}|demos/en/progress-bar:{basic.tsx,colors.tsx,custom-styles.tsx,custom-value.tsx,indeterminate.tsx,sizes.tsx,without-label.tsx}|demos/en/progress-circle:{basic.tsx,colors.tsx,custom-styles.tsx,custom-svg.tsx,indeterminate.tsx,sizes.tsx,with-label.tsx}|demos/en/radio-group:{basic.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,delivery-and-payment.tsx,disabled.tsx,horizontal.tsx,on-surface.tsx,render-function.tsx,uncontrolled.tsx,validation.tsx,variants.tsx}|demos/en/range-calendar:{allows-non-contiguous-ranges.tsx,anchor-unavailable-dates.tsx,basic.tsx,booking-calendar.tsx,controlled.tsx,custom-styles.tsx,day-view.tsx,default-value.tsx,disabled.tsx,focused-value.tsx,international-calendar.tsx,invalid.tsx,min-max-dates.tsx,multiple-months.tsx,read-only.tsx,unavailable-dates.tsx,week-view.tsx,weeks-in-month.tsx,with-indicators.tsx,year-picker.tsx}|demos/en/scroll-shadow:{custom-styles.tsx,default.tsx,hide-scroll-bar.tsx,orientation.tsx,size.tsx,visibility-change.tsx,with-card.tsx}|demos/en/search-field:{basic.tsx,controlled.tsx,custom-icons.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,on-surface.tsx,render-function.tsx,required.tsx,validation.tsx,variants.tsx,with-description.tsx,with-keyboard-shortcut.tsx,with-validation.tsx}|demos/en/select:{asynchronous-loading.tsx,controlled-multiple.tsx,controlled-open-state.tsx,controlled.tsx,custom-indicator.tsx,custom-styles.tsx,custom-value.tsx,default.tsx,disabled.tsx,full-width.tsx,multiple-select.tsx,on-surface.tsx,render-function.tsx,required.tsx,variants.tsx,with-clear-button.tsx,with-description.tsx,with-disabled-options.tsx,with-sections.tsx}|demos/en/separator:{basic.tsx,custom-styles.tsx,render-function.tsx,variants.tsx,vertical.tsx,with-content.tsx,with-surface.tsx}|demos/en/sheet:{backdrop-variants.tsx,basic.tsx,controlled.tsx,detached.tsx,handle-only.tsx,nested.tsx,non-dismissable.tsx,placements.tsx,professions-picker.tsx,scrollable-content.tsx,snap-points-custom-fade.tsx,snap-points-sequential.tsx,snap-points.tsx,with-form.tsx}|demos/en/skeleton:{animation-types.tsx,basic.tsx,custom-styles.tsx,grid.tsx,list.tsx,single-shimmer.tsx,text-content.tsx,user-profile.tsx}|demos/en/slider:{controlled.tsx,custom-output.tsx,custom-styles.tsx,custom-value-formatting.tsx,default.tsx,disabled.tsx,range-with-steps-and-marks.tsx,range.tsx,render-function.tsx,vertical-with-steps-and-marks.tsx,vertical.tsx,with-marks.tsx,with-steps-and-marks.tsx,with-steps.tsx}|demos/en/spinner:{basic.tsx,colors.tsx,custom-styles.tsx,sizes.tsx,speed.tsx}|demos/en/surface:{basic.tsx,custom-styles.tsx,variants.tsx,with-form-components.tsx}|demos/en/switch:{basic.tsx,controlled.tsx,custom-styles.tsx,default-selected.tsx,disabled.tsx,form.tsx,group-horizontal.tsx,group.tsx,label-position.tsx,render-function.tsx,render-props.tsx,sizes.tsx,with-description.tsx,with-icons.tsx,without-label.tsx}|demos/en/table:{async-loading.tsx,basic.tsx,column-resizing.tsx,custom-cells.tsx,custom-styles.tsx,empty-state.tsx,expandable-rows.tsx,pagination.tsx,secondary-variant.tsx,selection.tsx,sorting.tsx,tanstack-table.tsx,virtualization.tsx}|demos/en/tabs:{basic.tsx,custom-styles.tsx,disabled.tsx,overflow.tsx,render-function.tsx,secondary-vertical.tsx,secondary.tsx,vertical-alignment.tsx,vertical.tsx,with-separator.tsx}|demos/en/tag-group:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,render-function.tsx,selection-modes.tsx,sizes.tsx,variants.tsx,with-error-message.tsx,with-list-data.tsx,with-prefix.tsx,with-remove-button.tsx}|demos/en/textarea:{basic.tsx,controlled.tsx,custom-styles.tsx,full-width.tsx,on-surface.tsx,rows.tsx,variants.tsx}|demos/en/textfield:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,full-width.tsx,input-types.tsx,on-surface.tsx,render-function.tsx,required.tsx,textarea.tsx,validation.tsx,with-description.tsx,with-error.tsx}|demos/en/time-field:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,form-example.tsx,full-width.tsx,invalid.tsx,on-surface.tsx,render-function.tsx,required.tsx,with-description.tsx,with-prefix-and-suffix.tsx,with-prefix-icon.tsx,with-suffix-icon.tsx,with-validation.tsx}|demos/en/toast:{callbacks.tsx,custom-indicator.tsx,custom-queue.tsx,custom-styles.tsx,custom-toast.tsx,default.tsx,expanded.tsx,placements.tsx,promise.tsx,simple.tsx,variants.tsx}|demos/en/toggle-button-group:{attached.tsx,basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,full-width.tsx,orientation.tsx,selection-mode.tsx,sizes.tsx,without-separator.tsx}|demos/en/toggle-button:{basic.tsx,controlled.tsx,custom-styles.tsx,disabled.tsx,icon-only.tsx,sizes.tsx,variants.tsx}|demos/en/toolbar:{attached.tsx,basic.tsx,custom-styles.tsx,vertical.tsx,with-button-group.tsx}|demos/en/tooltip:{basic.tsx,custom-styles.tsx,custom-trigger.tsx,placement.tsx,render-function.tsx,with-arrow.tsx}|demos/en/typography:{custom-styles.tsx,default.tsx,primitives.tsx,prose.tsx,render-props.tsx,typography-scale.tsx}
<!-- HEROUI-REACT-AGENTS-MD-END -->

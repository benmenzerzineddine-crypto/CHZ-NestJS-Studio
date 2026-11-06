# Plans index

Master plan: [`../plan.md`](../plan.md)

Work through these in order; each one is a self-contained chunk with tasks,
acceptance criteria and verification commands.

| # | Plan | Status | Depends on |
| --- | --- | --- | --- |
| M0 | [Foundation](01-foundation.md) | in progress — automated checks green, desktop smoke pending | — |
| M1 | [Model designer & auth config](02-model-designer.md) | in progress — implementation complete, manual checks pending | M0 |
| M2 | [Generator core & auth code](03-generator-core.md) | done — automated + golden checks green, desktop export smoke pending | M1 |
| M3 | [Authorization & disk export](04-authorization-and-export.md) | done — SQLite/Postgres e2e + golden checks green; desktop smoke pending | M2 |
| M4 | [Depth & hardening](05-depth.md) | done — automated + manual desktop checks green | M3 |
| M5a | [One-command Docker verification](07-docker-verification.md) | done — SQLite/Postgres compose stacks build, health, login and seeds verified | M4 |
| M5b | [Standalone CLI](08-standalone-cli.md) | done — `validate`/`generate` over a project JSON, parity with the studio, tests green | M5a |
| M5c | [Password reset & email verification](09-password-reset-and-email-verification.md) | done — entities, mail service, endpoints, security invariants, tests green | M5b |
| M5d | [Custom endpoints](10-custom-endpoints.md) | done — schema, validation, IR, emitters, UI editor, review table, tests green | M5c |
| M5e | [File uploads & attachments](11-file-uploads-and-attachments.md) | done — entities, local/S3 drivers, controller, Swagger, UI controls, tests green | M5d |
| M5f | [Multi-tenancy scoping](12-multi-tenancy-scoping.md) | done — schema, validation, IR, emitters, UI & tests green | M5e |
| M5g | [Rate limiting & cache hints](13-rate-limiting-and-cache-hints.md) | done — schema, validation, IR, emitters, UI & tests green | M5f |
| M5h | [UI component refactor](14-ui-component-refactor.md) | done — primitives, subcomponents, modal & badge cleanup, tests green | M5g |
| M5i | [Diff preview](15-diff-preview.md) | done — store tracking, Monaco DiffEditor, tree indicators, tests green | M5h |
| M5j | [OAuth providers](16-oauth-providers.md) | done — passport strategies, routes, entity columns, UI & tests green | M5i |
| M5k | [Two-factor authentication](17-two-factor-authentication.md) | done — TOTP secrets, QR data URLs, recovery codes, step-up login, UI & tests green | M5j |
| M5l | [GraphQL schema & resolvers](18-graphql-resolvers.md) | done — code-first GraphQL schema & resolver generation, inputs, auth adapters, ApolloDriver AppModule wiring, UI & tests green | M5k |
| M5m | [HeroUI v3 UI migration](19-heroui-migration.md) | done — HeroUI v3 + styles, primitives migrated, Radix/CVA pruned, 443 tests + golden checks green | M5l |
| M5n | [Reverse Engineering & Schema Import](20-schema-and-db-import.md) | done — SQL DDL, TypeORM AST & OpenAPI importers, CLI & Studio dialog, 462 tests green | M5m |
| M5o | [Background Jobs & Queues](21-background-jobs-bullmq.md) | done — BullMQ, Redis, producers, processors, UI, 470 tests green | M5n |
| M5p | [Real-Time WebSockets](22-realtime-websockets.md) | done — Socket.IO gateway, JWT auth, CRUD broadcasting, UI | M5o |
| M5 | [Later backlog](06-later.md) | backlog | M4 |

## Working rules

- One milestone at a time. Do not start M(n+1) until M(n) is accepted.
- Update the status column as work progresses (`in progress` / `done`).
- If a decision changes, update `plan.md` first, then the affected step file.
- Every new behavior needs a test at the lowest possible layer (`src/core` first).

# Step 18 — GraphQL Schema & Resolvers (M5l)

**Goal:** Provide code-first GraphQL schema and resolver code generation using `@nestjs/graphql` and `@nestjs/apollo` (Apollo Driver), generating ObjectTypes, InputTypes, Query/Mutation resolvers, and GraphQL-compatible auth guards alongside existing REST endpoints.

- **Depends on:** [`17-two-factor-authentication.md`](17-two-factor-authentication.md) (M5k accepted)
- **Plan reference:** `plan.md` §2, §5; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- **Schema & Defaults (`src/core/model/schema.ts`, `src/core/model/defaults.ts`):**
  - Add `graphqlConfigSchema = z.strictObject({ enabled: z.boolean().default(false), playground: z.boolean().default(true), path: z.string().min(1).max(100).default("/graphql") })`.
  - Add `graphql: graphqlConfigSchema.default({ enabled: false, playground: true, path: "/graphql" })` to `projectSettingsSchema`.
  - Update `createProject` in `src/core/model/defaults.ts` with `defaultGraphQL()`.
- **IR (`src/core/ir/types.ts`, `src/core/ir/build.ts`):**
  - Add `GraphQLIR` interface and attach `graphql: GraphQLIR` to `ProjectIR`.
- **Entity ObjectTypes (`src/core/emit/entity.ts`):**
  - When `graphql.enabled` is true, decorate entity classes with `@ObjectType()` and fields with `@Field()`.
  - Support scalar mapping (`Int`, `Float`, `String`, `Boolean`, `Date`, `ID`).
  - Sensitive columns (`passwordHash`, `twoFactorSecret`, `twoFactorRecoveryCodes`) do not emit `@Field()`.
  - Relations decorated with `@Field(() => [TargetEntity], { nullable: true })` or `@Field(() => TargetEntity, { nullable: true })`.
- **GraphQL Inputs & Resolvers (`src/core/emit/graphql.ts`, `src/core/emit/helpers.ts`):**
  - For each entity:
    - Emit `Create<Entity>Input` (`src/<entity>/dto/create-<entity>.input.ts`) with `@InputType()` and `@Field()`.
    - Emit `Update<Entity>Input` (`src/<entity>/dto/update-<entity>.input.ts`) with `@InputType()`.
    - Emit `<Entity>Resolver` (`src/<entity>/<entity>.resolver.ts`) with queries (`<entities>`, `<entity>`) and mutations (`create<Entity>`, `update<Entity>`, `remove<Entity>`).
    - Hook access matrix rules into resolver queries/mutations with `@Public()` or `@Roles()`.
- **Auth Compatibility (`src/core/emit/auth-basics.ts`):**
  - When `graphql.enabled` is true, adapt `JwtAuthGuard`, `RolesGuard`, and `@CurrentUser()` to support both HTTP and `GqlExecutionContext`.
- **Module Registration (`src/core/emit/config.ts`, `src/core/emit/module.ts`):**
  - In `AppModule`: register `GraphQLModule.forRoot<ApolloDriverConfig>({ driver: ApolloDriver, autoSchemaFile: join(process.cwd(), "src/schema.gql"), sortSchema: true, playground: ..., path: ... })`.
  - In `<entity>.module.ts`: register `<Entity>Resolver` in `providers`.
- **Scaffold & Dependencies (`src/core/emit/scaffold.ts`):**
  - When `graphql.enabled` is true, add dependencies:
    `"@nestjs/graphql": "^13.0.3"`,
    `"@nestjs/apollo": "^13.0.3"`,
    `"@apollo/server": "^4.11.3"`,
    `"graphql": "^16.10.0"`.
- **Studio UI (`src/features/settings/SettingsScreen.tsx`):**
  - Add "GraphQL API" section in `SettingsScreen.tsx` with switches for Enabled, Playground, and Path input.
- **Testing & Verification:**
  - Schema & defaults unit tests.
  - Dedicated emitter test `src/core/emit/graphql.test.ts`.
  - SettingsScreen component test in `src/features/settings/SettingsScreen.test.tsx`.
  - Zero snapshot drift for default blog fixtures (`src/core/generate.test.ts`).
  - Full test suite passes (`npm test`) and production build succeeds (`npm run build`).

**Out:**
- Schema-first SDL (`.graphql` files parsed manually) — code-first is NestJS's primary paradigm.
- Subscriptions / WebSockets transport — separate later candidate.
- Federation / Subgraphs — enterprise backlog candidate.

---

## Tasks

### 18.1 Schema, Defaults & IR
- [x] Add `graphqlConfigSchema` and add `graphql` to `projectSettingsSchema` in `src/core/model/schema.ts`.
- [x] Export `defaultGraphQL()` and update `createProject` in `src/core/model/defaults.ts`.
- [x] Add `GraphQLIR` to `src/core/ir/types.ts` and populate it in `src/core/ir/build.ts`.
- [x] Update `schema.test.ts` and `defaults.test.ts`.

### 18.2 Entity ObjectTypes & Auth Adaptation
- [x] Update `src/core/emit/entity.ts` to conditionally emit `@ObjectType()` and `@Field()` decorators when `graphql.enabled` is true.
- [x] Update `src/core/emit/auth-basics.ts` to support `GqlExecutionContext` in `JwtAuthGuard`, `RolesGuard`, and `CurrentUser` when `graphql.enabled` is true.

### 18.3 Inputs & Resolvers Emission
- [x] Add path helpers in `src/core/emit/helpers.ts` for GraphQL inputs and resolvers.
- [x] Create `src/core/emit/graphql.ts` to emit `Create<Entity>Input`, `Update<Entity>Input`, and `<Entity>Resolver`.
- [x] Wire resolver and inputs into `generate.ts`.
- [x] Update `src/core/emit/module.ts` to include `<Entity>Resolver` in providers.
- [x] Update `emitAppModule` in `src/core/emit/config.ts` to register `GraphQLModule`.
- [x] Update `package.json` in `src/core/emit/scaffold.ts` to add `@nestjs/graphql`, `@nestjs/apollo`, `@apollo/server`, `graphql`.

### 18.4 Studio UI Controls
- [x] Add GraphQL section with toggles in `src/features/settings/SettingsScreen.tsx`.
- [x] Add component test in `src/features/settings/SettingsScreen.test.tsx`.

### 18.5 Tests & Verification
- [x] Add comprehensive emitter tests in `src/core/emit/graphql.test.ts`.
- [x] Verify zero snapshot drift on default blog project (`src/core/generate.test.ts`).
- [x] Run full test suite (`npm test`) and verify clean build (`npm run build`).

---

## Acceptance criteria

1. Enabling `settings.graphql.enabled` emits code-first GraphQL artifacts (`<entity>.input.ts`, `<entity>.resolver.ts`), `@ObjectType` decorators, and registers `GraphQLModule` in `AppModule`.
2. Resolvers provide Query and Mutation methods (`find`, `findOne`, `create`, `update`, `remove`) wired to existing service methods and respecting entity access levels.
3. When `graphql.enabled` is false (default), zero snapshot drift occurs for standard projects.
4. All automated tests pass cleanly and `npm run build` succeeds without type errors.

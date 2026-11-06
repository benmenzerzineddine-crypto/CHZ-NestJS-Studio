# Step 16 — OAuth Providers (Google & GitHub) (M5j)

**Goal:** Add Google and GitHub OAuth 2.0 third-party authentication support to generated NestJS backends, providing Passport strategies, callbacks, secure account linking/creation, and Studio UI configuration toggles with callback URL guidance.

- **Depends on:** [`15-diff-preview.md`](15-diff-preview.md) (M5i accepted)
- **Plan reference:** `plan.md` §2, §5; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- **Schema & Defaults (`src/core/model/schema.ts`, `src/core/model/defaults.ts`):**
  - Add `oauth: oauthProvidersSchema.default({ google: false, github: false })` to `authConfigSchema`.
  - Export `OAuthProviders` type and schema.
  - Update `defaultAuth` with `oauth: { google: false, github: false }`.
  - Add `googleId`, `githubId`, and `avatarUrl` to `AUTH_RESERVED_FIELD_NAMES`.
- **Entity Emission (`src/core/emit/entity.ts`):**
  - Make `passwordHash` nullable (`nullable: true`, `passwordHash?: string | null`) when OAuth is enabled.
  - Emit `@Column({ name: 'google_id', ... })` and `@Column({ name: 'github_id', ... })` with indexes when respective providers are enabled.
  - Emit `@Column({ name: 'avatar_url', ... })` when any OAuth provider is enabled.
- **Strategies & Auth Flow (`src/core/emit/auth.ts`, `src/core/emit/auth-basics.ts`, `src/core/emit/users.ts`):**
  - Emit `src/auth/strategies/google.strategy.ts` (`passport-google-oauth20`) when Google OAuth is enabled.
  - Emit `src/auth/strategies/github.strategy.ts` (`passport-github2`) when GitHub OAuth is enabled.
  - In `src/auth/auth.controller.ts`, emit `@Get('google')`, `@Get('google/callback')`, `@Get('github')`, and `@Get('github/callback')` with `@Public()` and `@UseGuards(AuthGuard(...))`.
  - In `src/auth/auth.service.ts`, implement `validateOAuthLogin(profile)` supporting existing account linking by email, lookup by OAuth ID, and creation of new users honoring `registerEnabled` and email verification.
  - In `src/users/users.service.ts`, add helper methods for OAuth user lookup, linking, and creation.
  - Update `src/auth/auth.module.ts` to register enabled strategies as providers.
- **Scaffold & Config (`src/core/emit/scaffold.ts`, `src/core/emit/config.ts`):**
  - Add `passport-google-oauth20`, `passport-github2`, and corresponding `@types/*` to `package.json` when enabled.
  - Emit client ID, client secret, and callback URL variables in `.env.example`.
- **Studio UI (`src/features/auth/AuthSettingsPanel.tsx`):**
  - Dedicated "OAuth 2.0 Providers" section in `AuthSettingsPanel`.
  - Toggles for Google and GitHub OAuth.
  - Display configured callback URLs (`/api/v1/auth/google/callback` and `/api/v1/auth/github/callback`) with copyable badge / code snippets.
- **Testing & Verification:**
  - Unit tests for schema validation and default fallback.
  - Emitter tests for generated Google & GitHub strategies, controller endpoints, entity columns, and `.env.example`.
  - Verify zero drift on default blog project snapshots.
  - Full suite passing (`npm test`) and clean build (`npm run build`).

**Out:**
- Custom proprietary OAuth 1.0a or SAML / Enterprise SSO (belongs to later enterprise backlog).
- Social sign-in popups in the Studio itself (the Studio generates the NestJS backend).

---

## Tasks

### 16.1 Schema & Defaults
- [x] Add `oauthProvidersSchema` and attach `oauth` to `authConfigSchema` in `src/core/model/schema.ts`.
- [x] Update `defaultAuth` in `src/core/model/defaults.ts`.
- [x] Update `AUTH_RESERVED_FIELD_NAMES` in `src/core/model/defaults.ts`.
- [x] Add unit tests in `src/core/model/schema.test.ts` and `src/core/model/defaults.test.ts`.

### 16.2 Entity & Strategy Emission
- [x] Update `src/core/emit/entity.ts` to emit nullable `passwordHash`, indexed `googleId` / `githubId`, and `avatarUrl` on `User` when OAuth is enabled.
- [x] Add path constants `AUTH_GOOGLE_STRATEGY_PATH` and `AUTH_GITHUB_STRATEGY_PATH` in `src/core/emit/helpers.ts`.
- [x] Create emitter functions for `google.strategy.ts` and `github.strategy.ts` in `src/core/emit/auth.ts`.
- [x] Add `findByOAuthId`, `linkOAuthAccount`, and `createOAuthUser` to `UsersService` emitter in `src/core/emit/users.ts`.
- [x] Add `validateOAuthLogin` to `AuthService` and OAuth endpoints to `AuthController` in `src/core/emit/auth.ts`.
- [x] Update `AuthModule` to import strategies.
- [x] Update `package.json` dependencies in `src/core/emit/scaffold.ts` and `.env.example` in `src/core/emit/scaffold.ts`.

### 16.3 Studio UI Configuration
- [x] Add OAuth section with Google and GitHub toggles in `src/features/auth/AuthSettingsPanel.tsx`.
- [x] Display callback URL hints formatted with the project's API prefix.

### 16.4 Tests & Verification
- [x] Add emitter unit tests in `src/core/emit/auth-extensions.test.ts`.
- [x] Verify existing snapshots pass with zero drift.
- [x] Run full test suite (`npm test`) and verify clean build (`npm run build`).

---

## Acceptance criteria

1. Enabling Google or GitHub OAuth in project configuration emits respective Passport strategies, controller routes, and package dependencies.
2. User entity accommodates OAuth users with nullable `passwordHash`, indexed provider ID columns, and `avatarUrl`.
3. OAuth callback handles account lookup by provider ID, linking to existing email accounts, and creating new users when registration is enabled.
4. When OAuth is disabled (default), zero snapshot drift occurs in standard project generation.
5. All automated tests pass cleanly and `npm run build` succeeds without type errors.

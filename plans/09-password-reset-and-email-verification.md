# Step 09 — Password reset & email verification (M5c)

**Goal:** extend the generated authentication system with secure password reset and
email verification flows, backed by single-use hashed tokens, a pluggable email
transport (console logger by default), and studio toggles that keep backward
compatibility intact.

- **Depends on:** [`08-standalone-cli.md`](08-standalone-cli.md) (M5b accepted)
- **Plan reference:** `plan.md` §6, §9; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- Opt-in toggles in `project.auth`: `passwordReset` (default `false`) and `emailVerification` (default `false`).
- Token TTL configs: `passwordResetTtl` (default `'1h'`), `emailVerificationTtl` (default `'24h'`).
- Generated database schema:
  - `PasswordReset` entity/table (`id`, `tokenHash`, `userId`, `expiresAt`, `usedAt`, `createdAt`).
  - `EmailVerification` entity/table (`id`, `tokenHash`, `userId`, `expiresAt`, `usedAt`, `createdAt`).
  - `User.emailVerifiedAt` timestamp column (nullable) when email verification is enabled.
- Generated auth endpoints:
  - `POST /api/auth/forgot-password` (throttled, constant-time response to prevent email enumeration).
  - `POST /api/auth/reset-password` (single-use validation, bcrypt hash update, refresh token invalidation).
  - `POST /api/auth/verify-email` (marks `emailVerifiedAt`, invalidates token).
  - `POST /api/auth/resend-verification` (throttled, generates fresh verification token).
- Email delivery abstraction in generated app:
  - `MailModule` + `MailService` interface with `ConsoleMailService` (safe default for local dev and Docker, logs reset/verification URLs with tokens to stdout).
  - Optional SMTP/transport configuration via environment variables.
- Authorization guard:
  - `@RequireVerifiedEmail()` decorator and guard to block unverified users when configured.
- Studio UI:
  - Toggles & TTL inputs in `src/features/auth/AuthSettings.tsx`.
- Pure pipeline & testing:
  - Zod schema extensions with default `false` for zero drift in existing models.
  - Unit tests for schema, emitters, and IR normalization.
  - Generated e2e specs for forgot-password, reset-password, and email verification lifecycle.

**Out:**
- Vendor-specific email SDK integrations (SendGrid, Postmark, AWS SES) in v1 core; console logger is standard, with env hooks.
- Front-end reset password HTML pages (the API provides JSON REST endpoints).
- SMS or 2FA (deferred to separate M5 tickets).

---

## Architecture & Security Invariants

1. **No Token Leakage in DB**:
   Raw tokens are 256-bit random hex strings. The database stores only `sha256(rawToken)`.
2. **Timing & Enumeration Resistance**:
   `POST /api/auth/forgot-password` always returns `200 OK` with `{ message: "If that email exists, a reset link was sent." }` regardless of whether the email was registered.
3. **Session Invalidation on Password Reset**:
   Upon successful password reset, all existing refresh tokens for the user in `refresh_tokens` are revoked (`revokedAt = now()`) so stolen tokens cannot remain active.
4. **Single-Use Enforced**:
   Tokens are marked with `usedAt = now()`; reused tokens are rejected.
5. **Throttling**:
   Both `forgot-password` and `resend-verification` endpoints are protected by `@nestjs/throttler` (e.g. 3 req/min).

---

## Tasks

### 9.1 Schema & Store
- [x] Add `passwordReset: z.boolean().default(false)` to `authConfigSchema`.
- [x] Add `emailVerification: z.boolean().default(false)` to `authConfigSchema`.
- [x] Add `passwordResetTtl: durationSchema.default('1h')` and `emailVerificationTtl: durationSchema.default('24h')`.
- [x] Update `defaultAuth()` in `src/core/model/defaults.ts`.
- [x] Update `migrateProject` to supply defaults when loading older project versions.
- [x] Add unit tests in `src/core/model/schema.test.ts`.

### 9.2 IR & Emitter Extensions
- [x] Normalize new auth settings in `src/core/ir/build.ts`.
- [x] Emit `PasswordReset` and `EmailVerification` TypeORM entities when enabled.
- [x] Emit `emailVerifiedAt` column on `User` entity when `emailVerification` is true.
- [x] Emit `MailModule` and `MailService` with console logger in generated `src/mail/`.
- [x] Emit DTOs: `ForgotPasswordDto`, `ResetPasswordDto`, `VerifyEmailDto`, `ResendVerificationDto`.
- [x] Emit endpoints & handlers in `auth.controller.ts` and `auth.service.ts`.
- [x] Emit `@RequireVerifiedEmail()` decorator & `VerifiedEmailGuard`.
- [x] Register new entities in `app.module.ts` / `typeorm.config.ts`.

### 9.3 Generated Tests
- [x] Add e2e test cases in generated `test/auth.e2e-spec.ts`:
  - Request reset token -> verify token hash in DB -> reset password -> login with new password -> old password fails.
  - Invalidate active refresh tokens on reset.
  - Verify email -> check `emailVerifiedAt` populated.

### 9.4 Studio UI
- [x] Update `src/features/auth/AuthSettingsPanel.tsx` with toggles for Password Reset & Email Verification and TTL inputs.
- [x] Ensure inputs use `BufferedInput` and disable when auth is off.
- [x] Add Endpoints screen rows for the new auth endpoints.

### 9.5 Verification & Hardening
- [x] Run `npm test` across all existing tests (no regressions in snapshots when flags are false).
- [x] Snapshot & unit tests for generated code with flags enabled (`auth-extensions.test.ts`).
- [x] Run `npm run build`.
- [x] Verify standalone CLI with new model JSON (`npm run chz -- generate`).

---

## Definition of Done

1. When `passwordReset` and `emailVerification` are `false`, generated output is byte-identical to previous releases.
2. Enabling either flag emits the corresponding entities, DTOs, mail module, controller endpoints, and services.
3. Tokens are hashed with SHA-256 before database insertion; raw tokens are never persisted.
4. `POST /api/auth/forgot-password` does not leak user existence.
5. All new and existing tests pass (`npm test` and `npm run build`).

---

## Verification Commands

```bash
npm test
npm run build
npm run chz -- validate src/core/fixtures/blog.json
```

---

## Verification Log

- 2026-11-04 — Implemented M5c.
  - Schema: added `passwordReset`, `emailVerification`, and configurable TTLs to `authConfigSchema` with defaults preserving backward compatibility for legacy v1 models.
  - Emitters: emitted `PasswordReset` and `EmailVerification` entities, `MailModule` / `MailService` (console logger default), DTOs, `AuthController` endpoints, `AuthService` token hashing & invalidation, `VerifiedEmailGuard`, and User entity `emailVerifiedAt` column.
  - Tests: `src/core/emit/auth-extensions.test.ts` (2 tests), `src/core/purity.test.ts` (1 test), and e2e test generation in `test/auth.e2e-spec.ts`.
  - UI: `AuthSettingsPanel.tsx` updated with switch toggles and `BufferedInput` TTL duration editors; `EndpointsScreen.tsx` updated with route review entries.
  - Verified: `npm test` (34 test files / 306 tests all pass), `npm run build` succeeds, CLI `validate` and `generate` verified.

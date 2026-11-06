# Step 17 — Two-Factor Authentication (2FA / TOTP) (M5k)

**Goal:** Implement Two-Factor Authentication (TOTP) with authenticator apps (Google Authenticator, Authy, 1Password) and single-use backup recovery codes in generated NestJS projects, complete with step-up verification during login and Studio UI toggles.

- **Depends on:** [`16-oauth-providers.md`](16-oauth-providers.md) (M5j accepted)
- **Plan reference:** `plan.md` §2, §5; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- **Schema & Defaults (`src/core/model/schema.ts`, `src/core/model/defaults.ts`):**
  - Add `twoFactor: z.boolean().default(false)` to `authConfigSchema`.
  - Update `defaultAuth` with `twoFactor: false`.
  - Add `twoFactorSecret`, `twoFactorEnabled`, and `twoFactorRecoveryCodes` to `AUTH_RESERVED_FIELD_NAMES`.
- **Entity Emission (`src/core/emit/entity.ts`):**
  - When `twoFactor` is enabled, emit on `User`:
    - `@Column({ name: 'two_factor_secret', type: 'varchar', length: 255, nullable: true, select: false })`
    - `@Column({ name: 'two_factor_enabled', type: 'boolean', default: false })`
    - `@Column({ name: 'two_factor_recovery_codes', type: 'simple-array', nullable: true, select: false })`
- **DTOs (`src/core/emit/auth.ts`, `src/core/emit/helpers.ts`):**
  - `TwoFactorEnableDto` (`code`: 6-digit TOTP string).
  - `TwoFactorVerifyDto` (`tempToken`: JWT, `code`: 6-digit TOTP code or recovery code).
  - `TwoFactorDisableDto` (`code`: 6-digit TOTP code).
- **Service & Controller Flow (`src/core/emit/auth.ts`, `src/core/emit/users.ts`):**
  - In `login` & OAuth callbacks: if `user.twoFactorEnabled` is active, return `{ requiresTwoFactor: true, tempToken }` instead of full access/refresh tokens.
  - `POST /auth/2fa/generate`: Authenticated endpoint that generates a TOTP secret and QR code data URL (using `otplib` and `qrcode`).
  - `POST /auth/2fa/enable`: Authenticated endpoint verifying initial code, enabling 2FA, and issuing 10 single-use recovery codes.
  - `POST /auth/2fa/disable`: Authenticated endpoint verifying code before turning off 2FA and wiping stored secret/recovery codes.
  - `POST /auth/2fa/verify`: Public, rate-limited endpoint verifying `tempToken` with TOTP or recovery code, granting full JWT credentials.
- **Scaffold & Dependencies (`src/core/emit/scaffold.ts`):**
  - Add `otplib: "^12.0.1"` and `qrcode: "^1.5.4"` to `dependencies`.
  - Add `@types/qrcode: "^1.5.5"` to `devDependencies`.
  - Emit `TWO_FACTOR_APP_NAME` in `.env.example`.
- **Studio UI (`src/features/auth/AuthSettingsPanel.tsx`):**
  - Add a "Two-Factor Authentication (2FA)" toggle row in `AuthSettingsPanel.tsx`.
- **Testing & Verification:**
  - Unit tests for schema validation and default migration.
  - Emitter tests for generated 2FA routes, DTOs, entity fields, and package dependencies.
  - Zero snapshot drift for default blog fixtures.
  - Full test suite passes (`npm test`) and production build succeeds (`npm run build`).

**Out:**
- SMS / Hardware security keys (WebAuthn/FIDO2) — separate future enterprise candidate.
- Requiring 2FA enrollment on initial registration (users opt-in or admins enforce via role policies).

---

## Tasks

### 17.1 Schema & Defaults
- [x] Add `twoFactor: z.boolean().default(false)` to `authConfigSchema` in `src/core/model/schema.ts`.
- [x] Update `defaultAuth` in `src/core/model/defaults.ts`.
- [x] Update `AUTH_RESERVED_FIELD_NAMES` in `src/core/model/defaults.ts`.
- [x] Update `schema.test.ts` and `defaults.test.ts`.

### 17.2 Entity & DTO Emission
- [x] Update `src/core/emit/entity.ts` to emit `twoFactorSecret`, `twoFactorEnabled`, and `twoFactorRecoveryCodes` on `User` when `twoFactor` is enabled.
- [x] Add path constants for 2FA DTOs in `src/core/emit/helpers.ts`.
- [x] Emit `TwoFactorEnableDto`, `TwoFactorVerifyDto`, and `TwoFactorDisableDto` in `src/core/emit/auth.ts`.

### 17.3 Auth Service, Controller & Module Flow
- [x] Update `login` method in `AuthService` to return step-up `{ requiresTwoFactor: true, tempToken }` when 2FA is active.
- [x] Implement `generateTwoFactorSecret`, `enableTwoFactor`, `disableTwoFactor`, and `verifyTwoFactor` in `AuthService`.
- [x] Add endpoints `POST /auth/2fa/generate`, `POST /auth/2fa/enable`, `POST /auth/2fa/disable`, and `POST /auth/2fa/verify` in `AuthController`.
- [x] Update `package.json` and `.env.example` in `src/core/emit/scaffold.ts`.

### 17.4 Studio UI Controls
- [x] Add 2FA toggle row in `src/features/auth/AuthSettingsPanel.tsx`.
- [x] Add component test in `src/features/auth/AuthSettingsPanel.test.tsx`.

### 17.5 Tests & Verification
- [x] Add 2FA emitter tests to `src/core/emit/auth-extensions.test.ts`.
- [x] Verify zero snapshot drift on default blog project.
- [x] Run full test suite (`npm test`) and verify clean build (`npm run build`).

---

## Acceptance criteria

1. Enabling `twoFactor` in project auth settings generates TOTP endpoints, DTOs, entity fields, and `otplib`/`qrcode` dependencies.
2. Users with `twoFactorEnabled = true` receive a temporary step-up token on login instead of direct access/refresh tokens.
3. Verification endpoint validates both live TOTP codes and single-use recovery codes, consuming used recovery codes.
4. When 2FA is disabled (default), zero snapshot drift occurs for standard projects.
5. All automated tests pass cleanly and `npm run build` succeeds without type errors.

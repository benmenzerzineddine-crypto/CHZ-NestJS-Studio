# Step 13 — Rate Limiting & Cache Hints (M5g)

**Goal:** Provide endpoint-level and entity-level rate limiting (`@Throttle()`, `@SkipThrottle()`) using `@nestjs/throttler` and HTTP response caching headers (`@Header('Cache-Control', ...)`), with global project defaults in Settings and fine-grained controls in the Entity Designer and Custom Endpoints Editor.

- **Depends on:** [`12-multi-tenancy-scoping.md`](12-multi-tenancy-scoping.md) (M5f accepted)
- **Plan reference:** `plan.md` §5, §9; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- Schema & Defaults:
  - `throttlingConfigSchema`: `{ enabled: boolean, ttl: number, limit: number }` with default `{ enabled: true, ttl: 60, limit: 100 }` on `projectSettingsSchema.throttling`.
  - `throttleOverrideSchema`: `{ limit: number, ttl: number }`.
  - `cacheHintSchema`: `{ maxAge: number, scope: 'public' | 'private' | 'no-cache' | 'no-store', sharedMaxAge?: number }`.
  - Added `throttle?: throttleOverrideSchema` and `cache?: cacheHintSchema` to `entityOptionsSchema`.
  - Added `throttle?: throttleOverrideSchema`, `skipThrottle?: boolean`, and `cache?: cacheHintSchema` to `customEndpointSchema`.
- Semantic Validation (`src/core/validate/validate.ts`):
  - Cache hints are only allowed on `GET` endpoints (error if set on non-GET custom endpoints).
  - Cannot specify both `skipThrottle: true` and a `throttle` override on the same endpoint.
  - Number ranges: `ttl >= 1`, `limit >= 1`, `maxAge >= 0`.
- IR & Emitters:
  - `ThrottlingConfig` attached to `ProjectIR`.
  - `throttle` and `cache` on `EntityIR` and `CustomEndpointIR`.
  - Emitters (`src/core/emit/`):
    - `config.ts` (`emitAppModule`): Emits `ThrottlerModule.forRoot([{ ttl: ..., limit: ... }])` and `APP_GUARD` `ThrottlerGuard` when enabled, omitted when disabled.
    - `controller.ts` (`emitController`):
      - Emits `@Throttle(...)` at entity controller or endpoint level when customized.
      - Emits `@SkipThrottle()` on custom endpoints configured to bypass throttling.
      - Emits `@Header('Cache-Control', ...)` on GET endpoints (`findAll`, `findOne`, and GET custom endpoints) when cache hints are specified.
- Studio UI:
  - Settings screen: Rate limiting card (enable switch, default TTL, default limit).
  - Entity Designer: Rate limiting and Cache Hint options in Entity options panel.
  - Custom Endpoints Editor: Throttle override mode (default, custom, skip) and Cache hint inputs (for GET routes).
  - Endpoints review: Badges for customized rate limits and cache headers.
- Testing & Invariants:
  - Zero snapshot drift for `blog.json` (defaults match the current hardcoded 60s/100 req throttler config).
  - Core purity maintained (no direct `node:*` imports in `src/core`).
  - Unit tests for schema, validation, IR, emitters, and store.

**Out:**
- Server-side Redis cache interceptor store (v1 emits standard HTTP Cache-Control response headers for edge/gateway/browser caching).

---

## Tasks

### 13.1 Schema & Defaults
- [x] Add `throttlingConfigSchema`, `throttleOverrideSchema`, `cacheHintSchema` to `src/core/model/schema.ts`.
- [x] Attach `throttling` to `projectSettingsSchema`, `throttle`/`cache` to `entityOptionsSchema`, and `throttle`/`skipThrottle`/`cache` to `customEndpointSchema`.
- [x] Update `defaultSettings` and `createCustomEndpoint` in `src/core/model/defaults.ts`.
- [x] Update `schema.test.ts` and `defaults.test.ts`.

### 13.2 Validation Engine
- [x] Add validation in `src/core/validate/validate.ts`:
  - Cache hint only on GET endpoints.
  - Conflicting `skipThrottle` and `throttle` on custom endpoints.
- [x] Update `src/core/validate/validate.test.ts`.

### 13.3 IR & Emitters
- [x] Update `ProjectIR`, `EntityIR`, and `CustomEndpointIR` in `src/core/ir/types.ts` & `src/core/ir/build.ts`.
- [x] Helper `renderCacheControl(cache: CacheHint): string` in `src/core/emit/helpers.ts`.
- [x] Update `src/core/emit/config.ts` to respect `ir.throttling`.
- [x] Update `src/core/emit/controller.ts` to emit `@Throttle`, `@SkipThrottle`, and `@Header('Cache-Control', ...)`.
- [x] Add unit tests in `src/core/emit/throttling-cache.test.ts`.

### 13.4 Studio UI Integration
- [x] Add store actions in `src/store/project.store.ts` for updating throttling settings.
- [x] Add Throttling / Rate Limiting section in `src/features/settings/SettingsScreen.tsx`.
- [x] Add Throttle & Cache options to `src/features/designer/EntityDetail.tsx`.
- [x] Add Throttle & Cache fields to `src/features/designer/CustomEndpointsEditor.tsx`.
- [x] Update `src/features/endpoints/EndpointsScreen.tsx` to render throttle and cache badges.

### 13.5 Verification & Hardening
- [x] Verify zero snapshot drift on `blog.json`.
- [x] Run `npm test` across all suites.
- [x] Run `npm run build`.
- [x] Verify CLI `validate` and `generate`.

---

## Definition of Done

1. Existing models without explicit overrides generate 100% byte-identical code (`blog.json` snapshot clean).
2. Disabling global throttling removes `ThrottlerModule` and `ThrottlerGuard` from `app.module.ts`.
3. Entity and custom endpoints emit `@Throttle()` and `@SkipThrottle()` correctly when specified.
4. GET endpoints emit `@Header('Cache-Control', ...)` correctly when cache hints are specified.
5. All test suites pass with zero regressions.

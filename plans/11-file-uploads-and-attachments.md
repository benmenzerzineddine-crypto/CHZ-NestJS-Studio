# Step 11 — File Uploads & Attachments (M5e)

**Goal:** Provide an integrated file attachments subsystem for generated NestJS projects,
supporting multipart file uploads, metadata storage in TypeORM, and storage drivers for
both local disk and S3-compatible object storage (AWS S3, MinIO, Cloudflare R2).

- **Depends on:** [`10-custom-endpoints.md`](10-custom-endpoints.md) (M5d accepted)
- **Plan reference:** `plan.md` §5, §9; [`06-later.md`](06-later.md)
- **Next step:** M5 backlog / next candidate

---

## Scope

**In:**
- Schema extension:
  - `storageDriverSchema` (`local` | `s3`).
  - `uploadConfigSchema` (`enabled: boolean`, `driver: "local" | "s3"`, `maxFileSizeMb: number`).
  - Added to `projectSettingsSchema` as `uploads: uploadConfigSchema.default({ enabled: false, driver: "local", maxFileSizeMb: 10 })`.
- Semantic validation:
  - Bounds checking for `maxFileSizeMb` (1 to 500 MB).
- IR & Emitters:
  - `UploadIR` attached to `ProjectIR`.
  - Conditional emission under `src/attachments/` when `ir.uploads.enabled` is `true`:
    - `attachment.entity.ts`: TypeORM entity tracking filename, originalName, mimeType, size, driver, path, createdAt.
    - `storage/storage.interface.ts`: `StorageEngine` contract (`save`, `getStream`, `delete`).
    - `storage/local-storage.service.ts`: Local disk engine with streaming and folder management.
    - `storage/s3-storage.service.ts`: S3-compatible engine with client integration.
    - `attachments.service.ts`: Business logic for persistence, lookup, streaming, and deletion.
    - `attachments.controller.ts`: `@Post('upload')`, `@Get(':id')`, `@Get(':id/download')`, `@Delete(':id')` with `@ApiConsumes('multipart/form-data')`.
    - `attachments.module.ts`: Wire up controller, service, TypeORM, and dynamic storage provider.
  - Wire into `src/app.module.ts` conditionally.
  - Update `.env.example` with upload/storage variables when enabled.
- Studio UI:
  - Uploads settings toggle in Settings screen / project configuration.
  - Driver selector ("Local disk" vs "S3-compatible").
  - Max file size input (in MB).
  - Listed in `EndpointsScreen.tsx` review table when enabled.
- Testing:
  - Unit tests for schema, migration, validation, IR, and emitters.
  - Zero snapshot drift for legacy fixtures (`blog.json`).

**Out:**
- Background video transcoding / thumbnail generation pipelines (left for background worker milestone).
- Direct browser-to-S3 presigned POST forms (v1 uses standard backend multipart streaming).

---

## Tasks

### 11.1 Schema & Defaults
- [x] Add `storageDriverSchema` and `uploadConfigSchema` to `src/core/model/schema.ts`.
- [x] Add `uploads` with `.default(...)` to `projectSettingsSchema`.
- [x] Add `defaultUploads` in `src/core/model/defaults.ts` and attach to `createProject`.
- [x] Update `src/core/model/schema.test.ts` and `src/core/model/defaults.test.ts`.

### 11.2 Validation Engine
- [x] Add validation rules in `src/core/validate/validate.ts` for upload settings bounds.
- [x] Update `src/core/validate/validate.test.ts`.

### 11.3 IR & Emitters
- [x] Normalize upload settings in `src/core/ir/build.ts` and attach `UploadIR` to `ProjectIR`.
- [x] Create `src/core/emit/attachments.ts` emitting `Attachment` entity, storage engines, service, controller, and module.
- [x] Connect `AttachmentsModule` in `src/core/emit/config.ts` (`app.module.ts`) when uploads are enabled.
- [x] Emit upload environment variables in `src/core/emit/env.ts` and `package.json` dependencies in `src/core/emit/package-json.ts`.
- [x] Add unit tests in `src/core/emit/attachments.test.ts`.

### 11.4 Studio UI & Review Integration
- [x] Add upload settings controls in `src/features/settings/` (or project settings UI).
- [x] Display attachment routes in `src/features/endpoints/EndpointsScreen.tsx`.
- [x] Add store mutator in `src/store/project.store.ts` for updating upload settings.

### 11.5 Verification & Hardening
- [x] Verify zero snapshot drift on `blog.json`.
- [x] Run `npm test` across all test suites.
- [x] Run `npm run build`.
- [x] Verify CLI `validate` and `generate` with uploads enabled.

---

## Definition of Done

1. When `uploads.enabled` is `false`, generated code is 100% byte-identical to previous releases.
2. When `uploads.enabled` is `true`, a complete, functional `AttachmentsModule` is emitted with Swagger multipart decorators, storage engines, and TypeORM entities.
3. Local disk driver streams to/from local filesystem; S3 driver is configured via standard environment variables.
4. Studio UI lets users toggle uploads and choose the storage driver.
5. All new and existing tests pass (`npm test` and `npm run build`).

import { moduleImport } from "../ir/imports";
import type { EntityIR, GeneratedFile, ProjectIR } from "../ir/types";

export const APP_MODULE_PATH = "src/app.module.ts";
export const MAIN_PATH = "src/main.ts";
export const HEALTH_PATH = "src/health/health.controller.ts";
export const ENUMS_PATH = "src/common/enums.ts";
export const ACCESS_PATH = "src/common/access/access-context.ts";
export const DURATION_PATH = "src/common/duration.ts";
export const PAGINATION_PATH = "src/common/dto/pagination-query.dto.ts";
export const PAGINATED_RESPONSE_PATH = "src/common/interfaces/paginated-response.interface.ts";
export const ALL_EXCEPTIONS_PATH = "src/common/filters/all-exceptions.filter.ts";
export const TRANSFORM_INTERCEPTOR_PATH = "src/common/interceptors/transform.interceptor.ts";
export const CURRENT_TENANT_PATH = "src/common/decorators/current-tenant.decorator.ts";
export const TYPEORM_CONFIG_PATH = "src/config/typeorm.config.ts";
export const SWAGGER_CONFIG_PATH = "src/config/swagger.config.ts";
export const DATA_SOURCE_PATH = "src/database/data-source.ts";
export const SEED_PATH = "src/database/seeds/seed.ts";
export const RUN_MIGRATIONS_PATH = "src/database/run-migrations.ts";

export const USER_ENTITY_PATH = "src/users/entities/user.entity.ts";
export const REFRESH_TOKEN_ENTITY_PATH = "src/users/entities/refresh-token.entity.ts";
export const USERS_SERVICE_PATH = "src/users/users.service.ts";
export const USERS_MODULE_PATH = "src/users/users.module.ts";
export const USERS_CONTROLLER_PATH = "src/users/users.controller.ts";
export const USERS_DTO_PROFILE_PATH = "src/users/dto/update-profile.dto.ts";
export const USERS_DTO_ROLES_PATH = "src/users/dto/update-roles.dto.ts";
export const USERS_DTO_PASSWORD_PATH = "src/users/dto/change-password.dto.ts";
export const USERS_DTO_QUERY_PATH = "src/users/dto/query-user.dto.ts";

export const AUTH_MODULE_PATH = "src/auth/auth.module.ts";
export const AUTH_SERVICE_PATH = "src/auth/auth.service.ts";
export const AUTH_CONTROLLER_PATH = "src/auth/auth.controller.ts";
export const AUTH_DTO_REGISTER_PATH = "src/auth/dto/register.dto.ts";
export const AUTH_DTO_LOGIN_PATH = "src/auth/dto/login.dto.ts";
export const AUTH_DTO_REFRESH_PATH = "src/auth/dto/refresh-token.dto.ts";
export const AUTH_DTO_LOGOUT_PATH = "src/auth/dto/logout.dto.ts";
export const AUTH_STRATEGY_PATH = "src/auth/strategies/jwt.strategy.ts";
export const AUTH_GOOGLE_STRATEGY_PATH = "src/auth/strategies/google.strategy.ts";
export const AUTH_GITHUB_STRATEGY_PATH = "src/auth/strategies/github.strategy.ts";
export const AUTH_GUARD_PATH = "src/auth/guards/jwt-auth.guard.ts";
export const AUTH_ROLES_GUARD_PATH = "src/auth/guards/roles.guard.ts";
export const AUTH_PUBLIC_PATH = "src/auth/decorators/public.decorator.ts";
export const AUTH_ROLES_PATH = "src/auth/decorators/roles.decorator.ts";
export const AUTH_CURRENT_USER_PATH = "src/auth/decorators/current-user.decorator.ts";
export const AUTH_USER_PATH = "src/auth/interfaces/auth-user.interface.ts";
export const AUTH_JWT_PAYLOAD_PATH = "src/auth/interfaces/jwt-payload.interface.ts";
export const PASSWORD_RESET_ENTITY_PATH = "src/users/entities/password-reset.entity.ts";
export const EMAIL_VERIFICATION_ENTITY_PATH = "src/users/entities/email-verification.entity.ts";
export const AUTH_DTO_FORGOT_PASSWORD_PATH = "src/auth/dto/forgot-password.dto.ts";
export const AUTH_DTO_RESET_PASSWORD_PATH = "src/auth/dto/reset-password.dto.ts";
export const AUTH_DTO_VERIFY_EMAIL_PATH = "src/auth/dto/verify-email.dto.ts";
export const AUTH_DTO_RESEND_VERIFICATION_PATH = "src/auth/dto/resend-verification.dto.ts";
export const MAIL_MODULE_PATH = "src/mail/mail.module.ts";
export const MAIL_SERVICE_PATH = "src/mail/mail.service.ts";
export const AUTH_VERIFIED_EMAIL_GUARD_PATH = "src/auth/guards/verified-email.guard.ts";
export const AUTH_REQUIRE_VERIFIED_EMAIL_PATH = "src/auth/decorators/require-verified-email.decorator.ts";
export const AUTH_DTO_2FA_ENABLE_PATH = "src/auth/dto/two-factor-enable.dto.ts";
export const AUTH_DTO_2FA_VERIFY_PATH = "src/auth/dto/two-factor-verify.dto.ts";
export const AUTH_DTO_2FA_DISABLE_PATH = "src/auth/dto/two-factor-disable.dto.ts";
export const AUTH_DTO_SESSION_PATH = "src/auth/dto/session.dto.ts";


export function entityFilePath(entity: EntityIR): string {
  return entity.isSystem
    ? USER_ENTITY_PATH
    : `${entity.moduleDir}/${entity.singularKebab}.entity.ts`;
}

export function entityDtoPath(entity: EntityIR, suffix: "create" | "update" | "query"): string {
  return `${entity.moduleDir}/dto/${suffix}-${entity.dtoPrefix}.dto.ts`;
}

export function entityServicePath(entity: EntityIR): string {
  return `${entity.moduleDir}/${entity.singularKebab}.service.ts`;
}

export function entityControllerPath(entity: EntityIR): string {
  return `${entity.moduleDir}/${entity.singularKebab}.controller.ts`;
}

export function entityResolverPath(entity: EntityIR): string {
  return `${entity.moduleDir}/${entity.singularKebab}.resolver.ts`;
}

export function entityInputPath(entity: EntityIR, suffix: "create" | "update"): string {
  return `${entity.moduleDir}/dto/${suffix}-${entity.dtoPrefix}.input.ts`;
}

export function entityModulePath(entity: EntityIR): string {
  return `${entity.moduleDir}/${entity.singularKebab}.module.ts`;
}

export function importPath(fromFile: string, toFile: string): string {
  return moduleImport(fromFile, toFile).replace(/\.ts$/, "");
}

export function sourceImport(fromFile: string, toFile: string): string {
  const path = importPath(fromFile, toFile);
  return path.startsWith(".") ? path : `./${path}`;
}

export function file(path: string, content: string, kind: GeneratedFile["kind"] = "typescript"): GeneratedFile {
  return { path, content, kind };
}

export function indexByPath(files: GeneratedFile[]): Map<string, GeneratedFile> {
  return new Map(files.map((generated) => [generated.path, generated]));
}

export function projectDescription(ir: ProjectIR): string {
  return `${ir.name} — generated NestJS + TypeORM REST API`;
}

export function renderCacheControl(cache: import("../model/schema").CacheHint): string {
  if (cache.scope === "no-store") return "no-store";
  if (cache.scope === "no-cache") return "no-cache";
  const parts = [`${cache.scope}, max-age=${cache.maxAge}`];
  if (cache.sharedMaxAge !== undefined && cache.scope === "public") {
    parts.push(`s-maxage=${cache.sharedMaxAge}`);
  }
  return parts.join(", ");
}

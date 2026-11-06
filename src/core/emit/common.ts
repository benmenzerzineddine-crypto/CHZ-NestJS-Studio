import type { ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import {
  ACCESS_PATH,
  ALL_EXCEPTIONS_PATH,
  CURRENT_TENANT_PATH,
  DURATION_PATH,
  PAGINATED_RESPONSE_PATH,
  PAGINATION_PATH,
  TRANSFORM_INTERCEPTOR_PATH,
  file,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";

export function emitAccessContext(ir: ProjectIR): GeneratedFile {
  const tenantHelper = ir.multitenancy.enabled
    ? `
/**
 * Multi-tenancy is enforced in the service layer. Queries are scoped to the current tenant id.
 */
export function applyTenantScope<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  tenantId: string | undefined,
): SelectQueryBuilder<Entity> {
  if (!tenantId) return qb.andWhere("1 = 0");
  return qb.andWhere(\`\${qb.alias}.tenantId = :currentTenantId\`, { currentTenantId: tenantId });
}
`
    : "";

  return file(
    ACCESS_PATH,
    `import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export function isAdmin(user: AuthUser | undefined, adminRole: string): boolean {
  return user?.roles.includes(adminRole) ?? false;
}
${tenantHelper}
/**
 * Ownership is enforced in the service layer. Admins bypass the scope; everybody
 * else only sees rows whose owner column matches their user id. Routes that use
 * this helper are authenticated by the global JWT guard.
 */
export function applyAccessScope<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  user: AuthUser | undefined,
  ownerColumn: string,
  adminRole: string,
): SelectQueryBuilder<Entity> {
  if (!user) return qb.andWhere("1 = 0");
  if (isAdmin(user, adminRole)) return qb;
  return qb.andWhere(\`\${qb.alias}.\${ownerColumn} = :currentUserId\`, { currentUserId: user.id });
}
`,
  );
}

export function emitDuration(_ir: ProjectIR): GeneratedFile {
  return file(
    DURATION_PATH,
    `/** Parses durations such as 15m or 7d into seconds. */
export function parseDuration(value: string): number {
  const match = /^(\\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(\`Invalid duration: \${value}\`);

  const amount = Number(match[1]);
  switch (match[2]) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      throw new Error(\`Invalid duration unit: \${match[2]}\`);
  }
}
`,
  );
}

export function emitPagination(_ir: ProjectIR): GeneratedFile[] {
  const queryRegistry = new ImportRegistry();
  queryRegistry.add("class-transformer", "Transform", "Type");
  queryRegistry.add(
    "class-validator",
    "IsBoolean",
    "IsIn",
    "IsInt",
    "IsOptional",
    "IsString",
    "Max",
    "Min",
  );
  queryRegistry.add("@nestjs/swagger", "ApiPropertyOptional");

  const query = `${queryRegistry.render()}export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional({ enum: ["ASC", "DESC"], default: "DESC" })
  @IsIn(["ASC", "DESC"])
  @IsOptional()
  order?: "ASC" | "DESC";

  @ApiPropertyOptional({
    default: false,
    description: "Include soft-deleted rows. Administrators only.",
  })
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === "true"))
  @IsBoolean()
  @IsOptional()
  withDeleted?: boolean;
}
`;

  const response = `export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
`;

  return [file(PAGINATION_PATH, query), file(PAGINATED_RESPONSE_PATH, response)];
}

export function emitExceptionFilter(_ir: ProjectIR): GeneratedFile {
  return file(
    ALL_EXCEPTIONS_PATH,
    `import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorBody {
  message?: string | string[];
  error?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const parsed = body as ErrorBody;
        message = parsed.message ?? exception.message;
        error = parsed.error ?? exception.name;
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
`,
  );
}

export function emitTransformInterceptor(_ir: ProjectIR): GeneratedFile {
  return file(
    TRANSFORM_INTERCEPTOR_PATH,
    `import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ApiResponse<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
`,
  );
}

export function emitCurrentTenantDecorator(ir: ProjectIR): GeneratedFile {
  const headerLower = ir.multitenancy.header.toLowerCase();
  const gqlImport = ir.graphql.enabled ? `\nimport { GqlExecutionContext } from "@nestjs/graphql";` : "";
  const requestLine = ir.graphql.enabled
    ? `    const request = ctx.getType<string>() === "graphql"
      ? GqlExecutionContext.create(ctx).getContext().req
      : ctx.switchToHttp().getRequest();`
    : `    const request = ctx.switchToHttp().getRequest();`;
  const headerAccess = ir.graphql.enabled
    ? `request?.headers?.[${JSON.stringify(headerLower)}]`
    : `request.headers[${JSON.stringify(headerLower)}]`;

    return file(
      CURRENT_TENANT_PATH,
      `import { BadRequestException, ExecutionContext, createParamDecorator } from "@nestjs/common";${gqlImport}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
${requestLine}
    const headerValue = ${headerAccess};
    const tenantId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
      throw new BadRequestException("Missing required ${ir.multitenancy.header} header");
    }
    return tenantId.trim();
  },
);
`,
    );
}

export function emitCommon(ir: ProjectIR): GeneratedFile[] {
  const files: GeneratedFile[] = [
    emitAccessContext(ir),
    emitDuration(ir),
    ...emitPagination(ir),
    emitExceptionFilter(ir),
    emitTransformInterceptor(ir),
  ];
  if (ir.multitenancy.enabled) {
    files.push(emitCurrentTenantDecorator(ir));
  }
  return files;
}

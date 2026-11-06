import type { ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import {
  AUTH_CURRENT_USER_PATH,
  AUTH_GUARD_PATH,
  AUTH_JWT_PAYLOAD_PATH,
  AUTH_PUBLIC_PATH,
  AUTH_ROLES_GUARD_PATH,
  AUTH_ROLES_PATH,
  AUTH_STRATEGY_PATH,
  AUTH_USER_PATH,
  file,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";

function emitAuthUser(ir: ProjectIR): GeneratedFile {
  const extra = ir.auth.emailVerification ? "\n  emailVerifiedAt?: string | null;" : "";
  const avatar = Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github)
    ? "\n  avatarUrl?: string | null;"
    : "";
  return file(
    AUTH_USER_PATH,
    `export interface AuthUser {
  id: string;
  email: string;
  roles: string[];${extra}${avatar}
}
`,
  );
}

function emitJwtPayload(ir: ProjectIR): GeneratedFile {
  const extra = ir.auth.emailVerification ? "\n  emailVerifiedAt?: string | null;" : "";
  const avatar = Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github)
    ? "\n  avatarUrl?: string | null;"
    : "";
  return file(
    AUTH_JWT_PAYLOAD_PATH,
    `export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];${extra}${avatar}
  iat?: number;
  exp?: number;
}
`,
  );
}

function emitPublic(): GeneratedFile {
  return file(
    AUTH_PUBLIC_PATH,
    `import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
`,
  );
}

function emitRoles(): GeneratedFile {
  return file(
    AUTH_ROLES_PATH,
    `import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
`,
  );
}

function emitCurrentUser(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "createParamDecorator");
  registry.addType("@nestjs/common", "ExecutionContext");
  registry.addType(
    sourceImport(AUTH_CURRENT_USER_PATH, AUTH_USER_PATH),
    "AuthUser",
  );
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "GqlExecutionContext");
  }

  const getRequestLine = ir.graphql.enabled
    ? `    const request = context.getType<string>() === "graphql"
      ? GqlExecutionContext.create(context).getContext().req
      : context.switchToHttp().getRequest<RequestWithUser>();`
    : `    const request = context.switchToHttp().getRequest<RequestWithUser>();`;
  const returnLine = ir.graphql.enabled ? "    return request?.user;" : "    return request.user;";

  const content = `${registry.render()}interface RequestWithUser {
  user?: AuthUser;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
${getRequestLine}
${returnLine}
  },
);
`;
  return file(AUTH_CURRENT_USER_PATH, content);
}

function emitJwtGuard(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Injectable");
  registry.addType("@nestjs/common", "ExecutionContext");
  registry.add("@nestjs/core", "Reflector");
  registry.add("@nestjs/passport", "AuthGuard");
  registry.add(sourceImport(AUTH_GUARD_PATH, AUTH_PUBLIC_PATH), "IS_PUBLIC_KEY");
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "GqlExecutionContext");
  }

  const getRequestOverride = ir.graphql.enabled
    ? `  getRequest(context: ExecutionContext) {
    if (context.getType<string>() === "graphql") {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext().req;
    }
    return context.switchToHttp().getRequest();
  }

`
    : "";

  const requestLine = ir.graphql.enabled
    ? `    const request = context.getType<string>() === "graphql"
      ? GqlExecutionContext.create(context).getContext().req
      : context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();`
    : `    const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();`;
  const headerCheck = ir.graphql.enabled
    ? "    if (!request?.headers?.authorization) return true;"
    : "    if (!request.headers?.authorization) return true;";

  const content = `${registry.render()}@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

${getRequestOverride}  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) return (await super.canActivate(context)) as boolean;

${requestLine}
${headerCheck}
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      // A public route stays public even when the caller sends a bad token.
      return true;
    }
  }
}
`;
  return file(AUTH_GUARD_PATH, content);
}

function emitRolesGuard(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "CanActivate", "ForbiddenException", "Injectable");
  registry.addType("@nestjs/common", "ExecutionContext");
  registry.add("@nestjs/core", "Reflector");
  registry.add(sourceImport(AUTH_ROLES_GUARD_PATH, AUTH_ROLES_PATH), "ROLES_KEY");
  registry.addType(sourceImport(AUTH_ROLES_GUARD_PATH, AUTH_USER_PATH), "AuthUser");
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "GqlExecutionContext");
  }

  const requestLine = ir.graphql.enabled
    ? `    const request = context.getType<string>() === "graphql"
      ? GqlExecutionContext.create(context).getContext().req
      : context.switchToHttp().getRequest<RequestWithUser>();`
    : `    const request = context.switchToHttp().getRequest<RequestWithUser>();`;
  const rolesExtract = ir.graphql.enabled
    ? "    const roles = request?.user?.roles ?? [];"
    : "    const roles = request.user?.roles ?? [];";

  const content = `${registry.render()}interface RequestWithUser {
  user?: AuthUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

${requestLine}
${rolesExtract}
    if (!required.some((role) => roles.includes(role))) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
`;
  return file(AUTH_ROLES_GUARD_PATH, content);
}

function emitStrategy(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Injectable", "UnauthorizedException");
  registry.add("@nestjs/config", "ConfigService");
  registry.add("@nestjs/passport", "PassportStrategy");
  registry.add("passport-jwt", "ExtractJwt", "Strategy");
  registry.addType(sourceImport(AUTH_STRATEGY_PATH, AUTH_JWT_PAYLOAD_PATH), "JwtPayload");
  registry.addType(sourceImport(AUTH_STRATEGY_PATH, AUTH_USER_PATH), "AuthUser");

  const validateExtra = ir.auth.emailVerification ? "\n      emailVerifiedAt: payload.emailVerifiedAt," : "";
  const validateAvatar = Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github)
    ? "\n      avatarUrl: payload.avatarUrl,"
    : "";
  const content = `${registry.render()}@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET") ?? "change-me-access-secret",
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload.sub) throw new UnauthorizedException("Invalid token");
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],${validateExtra}${validateAvatar}
    };
  }
}
`;
  return file(AUTH_STRATEGY_PATH, content);
}

export function emitAuthBasics(ir: ProjectIR): GeneratedFile[] {
  return [
    emitAuthUser(ir),
    emitJwtPayload(ir),
    emitPublic(),
    emitRoles(),
    emitCurrentUser(ir),
    emitJwtGuard(ir),
    emitRolesGuard(ir),
    emitStrategy(ir),
  ];
}

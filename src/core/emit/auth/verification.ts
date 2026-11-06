import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  AUTH_REQUIRE_VERIFIED_EMAIL_PATH,
  AUTH_VERIFIED_EMAIL_GUARD_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitRequireVerifiedEmailDecorator(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "SetMetadata");

  return file(
    AUTH_REQUIRE_VERIFIED_EMAIL_PATH,
    `${registry.render()}export const REQUIRE_VERIFIED_EMAIL_KEY = "requireVerifiedEmail";
export const RequireVerifiedEmail = () => SetMetadata(REQUIRE_VERIFIED_EMAIL_KEY, true);
`,
  );
}

export function emitVerifiedEmailGuard(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add(
    "@nestjs/common",
    "CanActivate",
    "ExecutionContext",
    "ForbiddenException",
    "Injectable",
  );
  registry.add("@nestjs/core", "Reflector");
  registry.add(
    sourceImport(AUTH_VERIFIED_EMAIL_GUARD_PATH, AUTH_REQUIRE_VERIFIED_EMAIL_PATH),
    "REQUIRE_VERIFIED_EMAIL_KEY",
  );
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "GqlExecutionContext");
  }

  const requestLine = ir.graphql.enabled
    ? `    const request = context.getType<string>() === "graphql"
      ? GqlExecutionContext.create(context).getContext().req
      : context.switchToHttp().getRequest();`
    : `    const request = context.switchToHttp().getRequest();`;

  return file(
    AUTH_VERIFIED_EMAIL_GUARD_PATH,
    `${registry.render()}@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_VERIFIED_EMAIL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

${requestLine}
    const user = request?.user;
    if (!user || !user.emailVerifiedAt) {
      throw new ForbiddenException("Email verification is required to access this resource");
    }
    return true;
  }
}
`,
  );
}

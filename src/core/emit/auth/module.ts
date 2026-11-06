import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  AUTH_CONTROLLER_PATH,
  AUTH_GITHUB_STRATEGY_PATH,
  AUTH_GOOGLE_STRATEGY_PATH,
  AUTH_MODULE_PATH,
  AUTH_SERVICE_PATH,
  AUTH_STRATEGY_PATH,
  DURATION_PATH,
  EMAIL_VERIFICATION_ENTITY_PATH,
  MAIL_MODULE_PATH,
  PASSWORD_RESET_ENTITY_PATH,
  REFRESH_TOKEN_ENTITY_PATH,
  USER_ENTITY_PATH,
  USERS_MODULE_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitAuthModule(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Module");
  registry.add("@nestjs/config", "ConfigModule", "ConfigService");
  registry.add("@nestjs/jwt", "JwtModule");
  registry.add("@nestjs/passport", "PassportModule");
  registry.add("@nestjs/typeorm", "TypeOrmModule");
  registry.add(sourceImport(AUTH_MODULE_PATH, DURATION_PATH), "parseDuration");
  registry.add(sourceImport(AUTH_MODULE_PATH, USER_ENTITY_PATH), "User");
  registry.add(sourceImport(AUTH_MODULE_PATH, REFRESH_TOKEN_ENTITY_PATH), "RefreshToken");
  if (ir.auth.passwordReset) {
    registry.add(sourceImport(AUTH_MODULE_PATH, PASSWORD_RESET_ENTITY_PATH), "PasswordReset");
  }
  if (ir.auth.emailVerification) {
    registry.add(sourceImport(AUTH_MODULE_PATH, EMAIL_VERIFICATION_ENTITY_PATH), "EmailVerification");
  }
  if (ir.auth.passwordReset || ir.auth.emailVerification) {
    registry.add(sourceImport(AUTH_MODULE_PATH, MAIL_MODULE_PATH), "MailModule");
  }
  registry.add(sourceImport(AUTH_MODULE_PATH, USERS_MODULE_PATH), "UsersModule");
  registry.add(sourceImport(AUTH_MODULE_PATH, AUTH_SERVICE_PATH), "AuthService");
  registry.add(sourceImport(AUTH_MODULE_PATH, AUTH_STRATEGY_PATH), "JwtStrategy");
  registry.add(sourceImport(AUTH_MODULE_PATH, AUTH_CONTROLLER_PATH), "AuthController");

  const entities = ["User", "RefreshToken"];
  if (ir.auth.passwordReset) entities.push("PasswordReset");
  if (ir.auth.emailVerification) entities.push("EmailVerification");

  const providers = ["AuthService", "JwtStrategy"];
  if (ir.auth.oauth?.google) {
    registry.add(sourceImport(AUTH_MODULE_PATH, AUTH_GOOGLE_STRATEGY_PATH), "GoogleStrategy");
    providers.push("GoogleStrategy");
  }
  if (ir.auth.oauth?.github) {
    registry.add(sourceImport(AUTH_MODULE_PATH, AUTH_GITHUB_STRATEGY_PATH), "GithubStrategy");
    providers.push("GithubStrategy");
  }

  const mailImport = ir.auth.passwordReset || ir.auth.emailVerification ? "\n    MailModule," : "";

  const content = `${registry.render()}@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET") ?? "change-me-access-secret",
        signOptions: {
          expiresIn: parseDuration(
            config.get<string>("JWT_ACCESS_TTL") ?? ${JSON.stringify(ir.auth.accessTokenTtl)},
          ),
        },
      }),
    }),
    TypeOrmModule.forFeature([${entities.join(", ")}]),
    UsersModule,${mailImport}
  ],
  controllers: [AuthController],
  providers: [${providers.join(", ")}],
  exports: [AuthService],
})
export class AuthModule {}
`;
  return file(AUTH_MODULE_PATH, content);
}

import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  EMAIL_VERIFICATION_ENTITY_PATH,
  PASSWORD_RESET_ENTITY_PATH,
  REFRESH_TOKEN_ENTITY_PATH,
  USERS_CONTROLLER_PATH,
  USERS_MODULE_PATH,
  USERS_SERVICE_PATH,
  USER_ENTITY_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitUsersModule(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Module");
  registry.add("@nestjs/typeorm", "TypeOrmModule");
  registry.add(sourceImport(USERS_MODULE_PATH, USER_ENTITY_PATH), "User");
  registry.add(sourceImport(USERS_MODULE_PATH, REFRESH_TOKEN_ENTITY_PATH), "RefreshToken");
  if (ir.auth.passwordReset) {
    registry.add(sourceImport(USERS_MODULE_PATH, PASSWORD_RESET_ENTITY_PATH), "PasswordReset");
  }
  if (ir.auth.emailVerification) {
    registry.add(sourceImport(USERS_MODULE_PATH, EMAIL_VERIFICATION_ENTITY_PATH), "EmailVerification");
  }
  registry.add(sourceImport(USERS_MODULE_PATH, USERS_SERVICE_PATH), "UsersService");
  if (ir.auth.enabled) {
    registry.add(sourceImport(USERS_MODULE_PATH, USERS_CONTROLLER_PATH), "UsersController");
  }

  const entities = ["User", "RefreshToken"];
  if (ir.auth.passwordReset) entities.push("PasswordReset");
  if (ir.auth.emailVerification) entities.push("EmailVerification");

  const exportsList = ["UsersService"];
  if (ir.auth.passwordReset || ir.auth.emailVerification) {
    exportsList.push("TypeOrmModule");
  }

  const controllers = ir.auth.enabled ? "\n  controllers: [UsersController]," : "";
  const content = `${registry.render()}@Module({
  imports: [TypeOrmModule.forFeature([${entities.join(", ")}])],${controllers}
  providers: [UsersService],
  exports: [${exportsList.join(", ")}],
})
export class UsersModule {}
`;
  return file(USERS_MODULE_PATH, content);
}

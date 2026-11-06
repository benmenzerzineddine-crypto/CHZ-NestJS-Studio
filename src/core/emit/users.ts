import type { GeneratedFile, ProjectIR } from "../ir/types";
import {
  emitChangePasswordDto,
  emitQueryUserDto,
  emitUpdateProfileDto,
  emitUpdateRolesDto,
} from "./users/dtos";
import {
  emitEmailVerificationEntity,
  emitPasswordResetEntity,
  emitRefreshTokenEntity,
  emitUserEntity,
} from "./users/entities";
import { emitUsersController } from "./users/controller";
import { emitUsersModule } from "./users/module";
import { emitUsersService } from "./users/service";

export {
  emitChangePasswordDto,
  emitEmailVerificationEntity,
  emitPasswordResetEntity,
  emitQueryUserDto,
  emitRefreshTokenEntity,
  emitUpdateProfileDto,
  emitUpdateRolesDto,
  emitUserEntity,
  emitUsersController,
  emitUsersModule,
  emitUsersService,
};

export function emitUsers(ir: ProjectIR): GeneratedFile[] {
  return [
    emitUserEntity(ir),
    emitRefreshTokenEntity(ir),
    ...(ir.auth.passwordReset ? [emitPasswordResetEntity(ir)] : []),
    ...(ir.auth.emailVerification ? [emitEmailVerificationEntity(ir)] : []),
    emitUpdateProfileDto(ir),
    emitUpdateRolesDto(ir),
    emitChangePasswordDto(ir),
    emitQueryUserDto(),
    emitUsersService(ir),
    emitUsersModule(ir),
    ...(ir.auth.enabled ? [emitUsersController(ir)] : []),
  ];
}

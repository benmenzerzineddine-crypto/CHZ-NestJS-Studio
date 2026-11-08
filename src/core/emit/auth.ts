import type { GeneratedFile, ProjectIR } from "../ir/types";
import {
  emitForgotPasswordDto,
  emitLoginDto,
  emitRefreshDto,
  emitRegisterDto,
  emitResendVerificationDto,
  emitResetPasswordDto,
  emitSessionDto,
  emitTwoFactorDisableDto,
  emitTwoFactorEnableDto,
  emitTwoFactorVerifyDto,
  emitVerifyEmailDto,
} from "./auth/dtos";
import {
  emitRequireVerifiedEmailDecorator,
  emitVerifiedEmailGuard,
} from "./auth/verification";
import { emitGithubStrategy, emitGoogleStrategy } from "./auth/oauth";
import { emitAuthService } from "./auth/service";
import { emitAuthController } from "./auth/controller";
import { emitAuthModule } from "./auth/module";
import { AUTH_DTO_REFRESH_PATH } from "./helpers";

export {
  emitAuthController,
  emitAuthModule,
  emitAuthService,
  emitForgotPasswordDto,
  emitGithubStrategy,
  emitGoogleStrategy,
  emitLoginDto,
  emitRefreshDto,
  emitRegisterDto,
  emitRequireVerifiedEmailDecorator,
  emitResendVerificationDto,
  emitResetPasswordDto,
  emitSessionDto,
  emitTwoFactorDisableDto,
  emitTwoFactorEnableDto,
  emitTwoFactorVerifyDto,
  emitVerifiedEmailGuard,
  emitVerifyEmailDto,
};

export function emitAuth(ir: ProjectIR): GeneratedFile[] {
  return [
    emitRegisterDto(ir),
    emitLoginDto(),
    emitRefreshDto(AUTH_DTO_REFRESH_PATH),
    ...(ir.auth.passwordReset ? [emitForgotPasswordDto(), emitResetPasswordDto(ir)] : []),
    ...(ir.auth.emailVerification
      ? [
          emitVerifyEmailDto(),
          emitResendVerificationDto(),
          emitRequireVerifiedEmailDecorator(),
          emitVerifiedEmailGuard(ir),
        ]
      : []),
    ...(ir.auth.twoFactor
      ? [
          emitTwoFactorEnableDto(),
          emitTwoFactorVerifyDto(),
          emitTwoFactorDisableDto(),
        ]
      : []),
    ...(ir.auth.sessionManagement ? [emitSessionDto()] : []),
    ...(ir.auth.oauth?.google ? [emitGoogleStrategy(ir)] : []),
    ...(ir.auth.oauth?.github ? [emitGithubStrategy(ir)] : []),
    emitAuthService(ir),
    emitAuthController(ir),
    emitAuthModule(ir),
  ];
}

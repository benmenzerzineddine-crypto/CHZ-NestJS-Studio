import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  AUTH_DTO_2FA_DISABLE_PATH,
  AUTH_DTO_2FA_ENABLE_PATH,
  AUTH_DTO_2FA_VERIFY_PATH,
  AUTH_DTO_FORGOT_PASSWORD_PATH,
  AUTH_DTO_LOGIN_PATH,
  AUTH_DTO_REGISTER_PATH,
  AUTH_DTO_RESEND_VERIFICATION_PATH,
  AUTH_DTO_RESET_PASSWORD_PATH,
  AUTH_DTO_VERIFY_EMAIL_PATH,
  file,
} from "../helpers";

export function emitRegisterDto(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsEmail", "IsString", "MinLength");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_REGISTER_PATH,
    `${registry.render()}export class RegisterDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: ${ir.auth.passwordMinLength} })
  @IsString()
  @MinLength(${ir.auth.passwordMinLength})
  password: string;
}
`,
  );
}

export function emitLoginDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsEmail", "IsString");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_LOGIN_PATH,
    `${registry.render()}export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}
`,
  );
}

export function emitRefreshDto(path: string): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsString");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    path,
    `${registry.render()}export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
`,
  );
}

export function emitForgotPasswordDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsEmail");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_FORGOT_PASSWORD_PATH,
    `${registry.render()}export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;
}
`,
  );
}

export function emitResetPasswordDto(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsString", "MinLength");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_RESET_PASSWORD_PATH,
    `${registry.render()}export class ResetPasswordDto {
  @ApiProperty({ description: "Single-use reset token" })
  @IsString()
  token: string;

  @ApiProperty({ minLength: ${ir.auth.passwordMinLength} })
  @IsString()
  @MinLength(${ir.auth.passwordMinLength})
  newPassword: string;
}
`,
  );
}

export function emitVerifyEmailDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsString");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_VERIFY_EMAIL_PATH,
    `${registry.render()}export class VerifyEmailDto {
  @ApiProperty({ description: "Email verification token" })
  @IsString()
  token: string;
}
`,
  );
}

export function emitResendVerificationDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsEmail");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_RESEND_VERIFICATION_PATH,
    `${registry.render()}export class ResendVerificationDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;
}
`,
  );
}

export function emitTwoFactorEnableDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsString", "Length");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_2FA_ENABLE_PATH,
    `${registry.render()}export class TwoFactorEnableDto {
  @ApiProperty({ description: "6-digit TOTP code from authenticator app", example: "123456" })
  @IsString()
  @Length(6, 6)
  code: string;
}
`,
  );
}

export function emitTwoFactorVerifyDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsString");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_2FA_VERIFY_PATH,
    `${registry.render()}export class TwoFactorVerifyDto {
  @ApiProperty({ description: "Temporary token issued during login" })
  @IsString()
  tempToken: string;

  @ApiProperty({ description: "6-digit TOTP code or backup recovery code", example: "123456" })
  @IsString()
  code: string;
}
`,
  );
}

export function emitTwoFactorDisableDto(): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("class-validator", "IsString", "Length");
  registry.add("@nestjs/swagger", "ApiProperty");

  return file(
    AUTH_DTO_2FA_DISABLE_PATH,
    `${registry.render()}export class TwoFactorDisableDto {
  @ApiProperty({ description: "6-digit TOTP code from authenticator app", example: "123456" })
  @IsString()
  @Length(6, 6)
  code: string;
}
`,
  );
}

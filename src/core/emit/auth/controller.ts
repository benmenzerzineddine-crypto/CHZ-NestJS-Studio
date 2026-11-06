import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  AUTH_CONTROLLER_PATH,
  AUTH_CURRENT_USER_PATH,
  AUTH_DTO_2FA_DISABLE_PATH,
  AUTH_DTO_2FA_ENABLE_PATH,
  AUTH_DTO_2FA_VERIFY_PATH,
  AUTH_DTO_FORGOT_PASSWORD_PATH,
  AUTH_DTO_LOGIN_PATH,
  AUTH_DTO_REFRESH_PATH,
  AUTH_DTO_REGISTER_PATH,
  AUTH_DTO_RESEND_VERIFICATION_PATH,
  AUTH_DTO_RESET_PASSWORD_PATH,
  AUTH_DTO_VERIFY_EMAIL_PATH,
  AUTH_PUBLIC_PATH,
  AUTH_SERVICE_PATH,
  AUTH_USER_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitAuthController(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Body", "Controller", "Get", "HttpCode", "Post");
  registry.add("@nestjs/swagger", "ApiBearerAuth", "ApiTags");
  registry.add("@nestjs/throttler", "Throttle");
  registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_SERVICE_PATH), "AuthService");
  registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_LOGIN_PATH), "LoginDto");
  if (ir.auth.registerEnabled) {
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_REGISTER_PATH), "RegisterDto");
  }
  if (ir.auth.refreshTokens) {
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_REFRESH_PATH), "RefreshTokenDto");
  }
  if (ir.auth.passwordReset) {
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_FORGOT_PASSWORD_PATH), "ForgotPasswordDto");
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_RESET_PASSWORD_PATH), "ResetPasswordDto");
  }
  if (ir.auth.emailVerification) {
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_VERIFY_EMAIL_PATH), "VerifyEmailDto");
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_RESEND_VERIFICATION_PATH), "ResendVerificationDto");
  }
  if (ir.auth.twoFactor) {
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_2FA_ENABLE_PATH), "TwoFactorEnableDto");
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_2FA_VERIFY_PATH), "TwoFactorVerifyDto");
    registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_DTO_2FA_DISABLE_PATH), "TwoFactorDisableDto");
  }
  registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_PUBLIC_PATH), "Public");
  registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_CURRENT_USER_PATH), "CurrentUser");
  registry.add(sourceImport(AUTH_CONTROLLER_PATH, AUTH_USER_PATH), "AuthUser");

  const hasOAuth = Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github);
  if (hasOAuth) {
    registry.add("@nestjs/common", "Req", "UseGuards");
    registry.add("@nestjs/passport", "AuthGuard");
  }

  const lines: string[] = [];
  lines.push("@ApiTags('auth')");
  lines.push("@Controller('auth')");
  lines.push("export class AuthController {");
  lines.push("  constructor(private readonly authService: AuthService) {}");
  lines.push("");

  if (ir.auth.registerEnabled) {
    lines.push("  @Public()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('register')");
    lines.push("  register(@Body() dto: RegisterDto) {");
    lines.push("    return this.authService.register(dto);");
    lines.push("  }");
    lines.push("");
  }

  lines.push("  @Public()");
  lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
  lines.push("  @Post('login')");
  lines.push("  @HttpCode(200)");
  lines.push("  login(@Body() dto: LoginDto) {");
  lines.push("    return this.authService.login(dto);");
  lines.push("  }");

  if (ir.auth.refreshTokens) {
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('refresh')");
    lines.push("  @HttpCode(200)");
    lines.push("  refresh(@Body() dto: RefreshTokenDto) {");
    lines.push("    return this.authService.refresh(dto);");
    lines.push("  }");
  }

  lines.push("");
  lines.push("  @Public()");
  lines.push("  @Throttle({ default: { limit: 10, ttl: 60_000 } })");
  lines.push("  @Post('logout')");
  lines.push("  @HttpCode(200)");
  if (ir.auth.refreshTokens) {
    lines.push("  logout(@Body() dto: RefreshTokenDto) {");
    lines.push("    return this.authService.logout(dto);");
  } else {
    lines.push("  logout() {");
    lines.push("    return { success: true };");
  }
  lines.push("  }");

  lines.push("");
  lines.push("  @ApiBearerAuth()");
  lines.push("  @Get('me')");
  lines.push("  me(@CurrentUser() user: AuthUser) {");
  lines.push("    return this.authService.me(user.id);");
  lines.push("  }");

  if (ir.auth.passwordReset) {
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Throttle({ default: { limit: 3, ttl: 60_000 } })");
    lines.push("  @Post('forgot-password')");
    lines.push("  @HttpCode(200)");
    lines.push("  forgotPassword(@Body() dto: ForgotPasswordDto) {");
    lines.push("    return this.authService.forgotPassword(dto.email);");
    lines.push("  }");
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('reset-password')");
    lines.push("  @HttpCode(200)");
    lines.push("  resetPassword(@Body() dto: ResetPasswordDto) {");
    lines.push("    return this.authService.resetPassword(dto.token, dto.newPassword);");
    lines.push("  }");
  }

  if (ir.auth.emailVerification) {
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('verify-email')");
    lines.push("  @HttpCode(200)");
    lines.push("  verifyEmail(@Body() dto: VerifyEmailDto) {");
    lines.push("    return this.authService.verifyEmail(dto.token);");
    lines.push("  }");
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Throttle({ default: { limit: 3, ttl: 60_000 } })");
    lines.push("  @Post('resend-verification')");
    lines.push("  @HttpCode(200)");
    lines.push("  resendVerification(@Body() dto: ResendVerificationDto) {");
    lines.push("    return this.authService.resendVerification(dto.email);");
    lines.push("  }");
  }

  if (ir.auth.twoFactor) {
    lines.push("");
    lines.push("  @ApiBearerAuth()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('2fa/generate')");
    lines.push("  generateTwoFactor(@CurrentUser() user: AuthUser) {");
    lines.push("    return this.authService.generateTwoFactor(user.id);");
    lines.push("  }");
    lines.push("");
    lines.push("  @ApiBearerAuth()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('2fa/enable')");
    lines.push("  enableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorEnableDto) {");
    lines.push("    return this.authService.enableTwoFactor(user.id, dto.code);");
    lines.push("  }");
    lines.push("");
    lines.push("  @ApiBearerAuth()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('2fa/disable')");
    lines.push("  disableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDisableDto) {");
    lines.push("    return this.authService.disableTwoFactor(user.id, dto.code);");
    lines.push("  }");
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Throttle({ default: { limit: 5, ttl: 60_000 } })");
    lines.push("  @Post('2fa/verify')");
    lines.push("  @HttpCode(200)");
    lines.push("  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {");
    lines.push("    return this.authService.verifyTwoFactor(dto.tempToken, dto.code);");
    lines.push("  }");
  }

  if (ir.auth.oauth?.google) {
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Get('google')");
    lines.push("  @UseGuards(AuthGuard('google'))");
    lines.push("  googleAuth() {");
    lines.push("    // Passport initiates redirect");
    lines.push("  }");
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Get('google/callback')");
    lines.push("  @UseGuards(AuthGuard('google'))");
    lines.push("  googleCallback(@Req() req: any) {");
    lines.push("    return this.authService.validateOAuthLogin(req.user);");
    lines.push("  }");
  }

  if (ir.auth.oauth?.github) {
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Get('github')");
    lines.push("  @UseGuards(AuthGuard('github'))");
    lines.push("  githubAuth() {");
    lines.push("    // Passport initiates redirect");
    lines.push("  }");
    lines.push("");
    lines.push("  @Public()");
    lines.push("  @Get('github/callback')");
    lines.push("  @UseGuards(AuthGuard('github'))");
    lines.push("  githubCallback(@Req() req: any) {");
    lines.push("    return this.authService.validateOAuthLogin(req.user);");
    lines.push("  }");
  }

  lines.push("}");

  return file(AUTH_CONTROLLER_PATH, `${registry.render()}${lines.join("\n")}\n`);
}

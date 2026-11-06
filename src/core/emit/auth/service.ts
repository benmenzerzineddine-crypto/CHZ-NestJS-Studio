import type { GeneratedFile, ProjectIR } from "../../ir/types";
import { ImportRegistry } from "../../ir/imports";
import {
  AUTH_DTO_LOGIN_PATH,
  AUTH_DTO_REFRESH_PATH,
  AUTH_DTO_REGISTER_PATH,
  AUTH_SERVICE_PATH,
  DURATION_PATH,
  EMAIL_VERIFICATION_ENTITY_PATH,
  MAIL_SERVICE_PATH,
  PASSWORD_RESET_ENTITY_PATH,
  REFRESH_TOKEN_ENTITY_PATH,
  USER_ENTITY_PATH,
  USERS_SERVICE_PATH,
  file,
  sourceImport,
} from "../helpers";

export function emitAuthService(ir: ProjectIR): GeneratedFile {
  const registry = new ImportRegistry();
  registry.add(
    "@nestjs/common",
    "ConflictException",
    "ForbiddenException",
    "Injectable",
    "UnauthorizedException",
  );
  if (
    ir.auth.passwordReset ||
    ir.auth.emailVerification ||
    ir.auth.oauth?.google ||
    ir.auth.oauth?.github ||
    ir.auth.twoFactor
  ) {
    registry.add("@nestjs/common", "BadRequestException");
  }
  if (ir.auth.passwordReset || ir.auth.emailVerification) {
    registry.add("typeorm", "IsNull");
    registry.add(sourceImport(AUTH_SERVICE_PATH, MAIL_SERVICE_PATH), "MailService");
  }
  if (ir.auth.twoFactor) {
    registry.add("otplib", "authenticator");
    registry.add("qrcode", "toDataURL");
  }
  registry.add("@nestjs/config", "ConfigService");
  registry.add("@nestjs/jwt", "JwtService");
  registry.add("@nestjs/typeorm", "InjectRepository");
  registry.add("typeorm", "Repository");
  registry.add("node:crypto", "createHash", "randomBytes");
  registry.add(sourceImport(AUTH_SERVICE_PATH, DURATION_PATH), "parseDuration");
  registry.add(sourceImport(AUTH_SERVICE_PATH, USERS_SERVICE_PATH), "UsersService");
  registry.addType(sourceImport(AUTH_SERVICE_PATH, USER_ENTITY_PATH), "User");
  registry.add(sourceImport(AUTH_SERVICE_PATH, REFRESH_TOKEN_ENTITY_PATH), "RefreshToken");
  if (ir.auth.passwordReset) {
    registry.add(sourceImport(AUTH_SERVICE_PATH, PASSWORD_RESET_ENTITY_PATH), "PasswordReset");
  }
  if (ir.auth.emailVerification) {
    registry.add(sourceImport(AUTH_SERVICE_PATH, EMAIL_VERIFICATION_ENTITY_PATH), "EmailVerification");
  }
  registry.add(sourceImport(AUTH_SERVICE_PATH, AUTH_DTO_REGISTER_PATH), "RegisterDto");
  registry.add(sourceImport(AUTH_SERVICE_PATH, AUTH_DTO_LOGIN_PATH), "LoginDto");
  registry.add(sourceImport(AUTH_SERVICE_PATH, AUTH_DTO_REFRESH_PATH), "RefreshTokenDto");

  const defaultRole = JSON.stringify(ir.auth.defaultRole);
  const registerEnabled = ir.auth.registerEnabled ? "true" : "false";
  const refreshEnabled = ir.auth.refreshTokens ? "true" : "false";

  const constructorInjections = [
    "    private readonly usersService: UsersService,",
    "    private readonly jwtService: JwtService,",
    "    private readonly config: ConfigService,",
    "    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,",
  ];
  if (ir.auth.passwordReset) {
    constructorInjections.push(
      "    @InjectRepository(PasswordReset) private readonly passwordResets: Repository<PasswordReset>,",
    );
  }
  if (ir.auth.emailVerification) {
    constructorInjections.push(
      "    @InjectRepository(EmailVerification) private readonly emailVerifications: Repository<EmailVerification>,",
    );
  }
  if (ir.auth.passwordReset || ir.auth.emailVerification) {
    constructorInjections.push("    private readonly mailService: MailService,");
  }

  const extraMethods: string[] = [];

  if (ir.auth.passwordReset) {
    extraMethods.push(`  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.isActive) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = this.hashToken(rawToken);
      const ttl = parseDuration(
        this.config.get<string>("PASSWORD_RESET_TTL") ?? ${JSON.stringify(ir.auth.passwordResetTtl)},
      );
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await this.passwordResets.save(
        this.passwordResets.create({ tokenHash, userId: user.id, expiresAt }),
      );
      await this.mailService.send({
        to: user.email,
        subject: "Password Reset Request",
        text: \`Your password reset token is: \${rawToken}\\nIt expires in \${ttl} seconds.\`,
      });
    }
    return { message: "If that email exists, a password reset link has been sent." };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(token);
    const record = await this.passwordResets.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Invalid or expired password reset token");
    }
    await this.usersService.resetPassword(record.userId, newPassword);
    record.usedAt = new Date();
    await this.passwordResets.save(record);
    return { message: "Password has been reset successfully." };
  }`);
  }

  if (ir.auth.emailVerification) {
    extraMethods.push(`  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(token);
    const record = await this.emailVerifications.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Invalid or expired email verification token");
    }
    await this.usersService.markEmailVerified(record.userId);
    record.usedAt = new Date();
    await this.emailVerifications.save(record);
    return { message: "Email has been successfully verified." };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.isActive && !user.emailVerifiedAt) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = this.hashToken(rawToken);
      const ttl = parseDuration(
        this.config.get<string>("EMAIL_VERIFICATION_TTL") ?? ${JSON.stringify(ir.auth.emailVerificationTtl)},
      );
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await this.emailVerifications.save(
        this.emailVerifications.create({ tokenHash, userId: user.id, expiresAt }),
      );
      await this.mailService.send({
        to: user.email,
        subject: "Verify Your Email",
        text: \`Your email verification token is: \${rawToken}\\nIt expires in \${ttl} seconds.\`,
      });
    }
    return {
      message: "If that email exists and is unverified, a verification link has been sent.",
    };
  }`);
  }

  if (ir.auth.oauth?.google || ir.auth.oauth?.github) {
    extraMethods.push(`  async validateOAuthLogin(profile: {
    provider: "google" | "github";
    id: string;
    email?: string;
    avatarUrl?: string;
  }) {
    if (!profile.email) {
      throw new BadRequestException("Email is required from OAuth provider");
    }

    let user = await this.usersService.findByOAuthId(profile.provider, profile.id);
    if (user) {
      if (!user.isActive) throw new UnauthorizedException("User account is inactive");
      if (profile.avatarUrl && !user.avatarUrl) {
        user = await this.usersService.linkOAuthAccount(user, profile.provider, profile.id, profile.avatarUrl);
      }
${ir.auth.twoFactor ? `      if (user.twoFactorEnabled) {
        const tempToken = await this.jwtService.signAsync(
          { sub: user.id, is2FaTemp: true },
          { expiresIn: "5m" },
        );
        return { requiresTwoFactor: true, tempToken };
      }
` : ""}      return this.issueTokens(user);
    }

    user = await this.usersService.findByEmail(profile.email);
    if (user) {
      if (!user.isActive) throw new UnauthorizedException("User account is inactive");
      user = await this.usersService.linkOAuthAccount(user, profile.provider, profile.id, profile.avatarUrl);
${ir.auth.twoFactor ? `      if (user.twoFactorEnabled) {
        const tempToken = await this.jwtService.signAsync(
          { sub: user.id, is2FaTemp: true },
          { expiresIn: "5m" },
        );
        return { requiresTwoFactor: true, tempToken };
      }
` : ""}      return this.issueTokens(user);
    }

    if (!REGISTER_ENABLED) {
      throw new ForbiddenException("Registration is disabled");
    }

    user = await this.usersService.createOAuthUser(
      profile.email,
      profile.provider,
      profile.id,
      profile.avatarUrl,
      [DEFAULT_ROLE],
    );
    return this.issueTokens(user);
  }`);
  }

  if (ir.auth.twoFactor) {
    extraMethods.push(`  async generateTwoFactor(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");
    const secret = authenticator.generateSecret();
    const appName = this.config.get<string>("TWO_FACTOR_APP_NAME") ?? ${JSON.stringify(ir.name)};
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCode = await toDataURL(otpauthUrl);
    await this.usersService.setTwoFactorSecret(user.id, secret);
    return { secret, qrCode, otpauthUrl };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.usersService.findByIdWithTwoFactor(userId);
    if (!user) throw new UnauthorizedException("User not found");
    if (!user.twoFactorSecret) {
      throw new BadRequestException("Two-factor secret has not been generated");
    }
    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new BadRequestException("Invalid two-factor code");
    }
    const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(5).toString("hex").toUpperCase());
    await this.usersService.enableTwoFactor(user.id, recoveryCodes);
    return {
      message: "Two-factor authentication has been enabled successfully.",
      recoveryCodes,
    };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.usersService.findByIdWithTwoFactor(userId);
    if (!user) throw new UnauthorizedException("User not found");
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException("Two-factor authentication is not enabled");
    }
    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new BadRequestException("Invalid two-factor code");
    }
    await this.usersService.disableTwoFactor(user.id);
    return { message: "Two-factor authentication has been disabled." };
  }

  async verifyTwoFactor(tempToken: string, code: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(tempToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired two-factor temporary token");
    }
    if (!payload?.is2FaTemp || !payload?.sub) {
      throw new UnauthorizedException("Invalid two-factor token");
    }
    const user = await this.usersService.findByIdWithTwoFactor(payload.sub);
    if (!user || !user.isActive || !user.twoFactorEnabled) {
      throw new UnauthorizedException("Invalid user or two-factor is not enabled");
    }

    const isTotpValid = user.twoFactorSecret
      ? authenticator.verify({ token: code, secret: user.twoFactorSecret })
      : false;

    if (isTotpValid) {
      return this.issueTokens(user);
    }

    const recoveryCodes = user.twoFactorRecoveryCodes ?? [];
    const normalizedInput = code.trim().toUpperCase();
    const codeIndex = recoveryCodes.findIndex((c) => c.toUpperCase() === normalizedInput);
    if (codeIndex !== -1) {
      const remainingCodes = recoveryCodes.filter((_, idx) => idx !== codeIndex);
      await this.usersService.consumeRecoveryCode(user.id, remainingCodes);
      return this.issueTokens(user);
    }

    throw new UnauthorizedException("Invalid two-factor authentication code");
  }`);
  }

  const hasOAuth = Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github);
  const payloadLines = [
    "      sub: user.id,",
    "      email: user.email,",
    "      roles: user.roles,",
  ];
  if (ir.auth.emailVerification) {
    payloadLines.push("      ...(user.emailVerifiedAt ? { emailVerifiedAt: user.emailVerifiedAt.toISOString() } : {}),");
  }
  if (hasOAuth) {
    payloadLines.push("      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),");
  }
  const issueTokensPayload = payloadLines.join("\n");

  const extraMethodsBlock = extraMethods.length > 0 ? `\n\n${extraMethods.join("\n\n")}` : "";

  const content = `${registry.render()}const REGISTER_ENABLED = ${registerEnabled};
const REFRESH_TOKENS_ENABLED = ${refreshEnabled};
const DEFAULT_ROLE = ${defaultRole};

@Injectable()
export class AuthService {
  constructor(
${constructorInjections.join("\n")}
  ) {}

  async register(dto: RegisterDto) {
    if (!REGISTER_ENABLED) throw new ForbiddenException("Registration is disabled");
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException("Email already registered");
    const user = await this.usersService.create(dto.email, dto.password, [DEFAULT_ROLE]);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user || !user.isActive || !(await this.usersService.checkPassword(user, dto.password))) {
      throw new UnauthorizedException("Invalid email or password");
    }
${ir.auth.twoFactor ? `    if (user.twoFactorEnabled) {
      const tempToken = await this.jwtService.signAsync(
        { sub: user.id, is2FaTemp: true },
        { expiresIn: "5m" },
      );
      return { requiresTwoFactor: true, tempToken };
    }
` : ""}    return this.issueTokens(user);
  }

  async refresh(dto: RefreshTokenDto) {
    if (!REFRESH_TOKENS_ENABLED) throw new UnauthorizedException("Refresh tokens are disabled");
    const tokenHash = this.hashToken(dto.refreshToken);
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash },
      relations: { user: true },
    });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() <= Date.now() ||
      !stored.user ||
      !stored.user.isActive
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueTokens(stored.user);
  }

  async logout(dto: RefreshTokenDto): Promise<{ success: boolean }> {
    if (REFRESH_TOKENS_ENABLED) {
      const tokenHash = this.hashToken(dto.refreshToken);
      await this.refreshTokens.update({ tokenHash }, { revokedAt: new Date() });
    }
    return { success: true };
  }

  async me(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");
    return user;
  }

  private async issueTokens(user: User) {
    const accessToken = await this.jwtService.signAsync({
${issueTokensPayload}
    });

    if (!REFRESH_TOKENS_ENABLED) {
      return { accessToken, user };
    }

    const refreshToken = randomBytes(48).toString("base64url");
    const tokenHash = this.hashToken(refreshToken);
    const ttl = parseDuration(this.config.get<string>("JWT_REFRESH_TTL") ?? ${JSON.stringify(ir.auth.refreshTokenTtl)});
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.refreshTokens.save(
      this.refreshTokens.create({ tokenHash, expiresAt, userId: user.id }),
    );
    return { accessToken, refreshToken, user };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }${extraMethodsBlock}
}
`;
  return file(AUTH_SERVICE_PATH, content);
}

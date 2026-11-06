import type { ProjectIR } from "../../ir/types";

export function buildPasswordResetMethods(ir: ProjectIR): string {
  if (!ir.auth.passwordReset) return "";
  return `  async forgotPassword(email: string): Promise<{ message: string }> {
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
  }`;
}

export function buildEmailVerificationMethods(ir: ProjectIR): string {
  if (!ir.auth.emailVerification) return "";
  return `  async verifyEmail(token: string): Promise<{ message: string }> {
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
  }`;
}

export function buildOAuthMethods(ir: ProjectIR): string {
  if (!ir.auth.oauth?.google && !ir.auth.oauth?.github) return "";
  return `  async validateOAuthLogin(profile: {
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
  }`;
}

export function buildTwoFactorMethods(ir: ProjectIR): string {
  if (!ir.auth.twoFactor) return "";
  return `  async generateTwoFactor(userId: string) {
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
  }`;
}

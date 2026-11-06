import { describe, expect, it } from "vitest";
import { generateProject } from "../generate";
import { createProject } from "../model/defaults";

describe("Password Reset & Email Verification emitters", () => {
  it("emits password reset and email verification files when enabled", async () => {
    const project = createProject("Auth Ext API");
    project.auth.passwordReset = true;
    project.auth.emailVerification = true;
    project.auth.passwordResetTtl = "30m";
    project.auth.emailVerificationTtl = "48h";

    const result = await generateProject(project);
    const paths = result.files.map((file) => file.path);

    // Entities
    expect(paths).toContain("src/users/entities/password-reset.entity.ts");
    expect(paths).toContain("src/users/entities/email-verification.entity.ts");

    // Mail module
    expect(paths).toContain("src/mail/mail.service.ts");
    expect(paths).toContain("src/mail/mail.module.ts");

    // DTOs
    expect(paths).toContain("src/auth/dto/forgot-password.dto.ts");
    expect(paths).toContain("src/auth/dto/reset-password.dto.ts");
    expect(paths).toContain("src/auth/dto/verify-email.dto.ts");
    expect(paths).toContain("src/auth/dto/resend-verification.dto.ts");

    // Guards and decorators
    expect(paths).toContain("src/auth/guards/verified-email.guard.ts");
    expect(paths).toContain("src/auth/decorators/require-verified-email.decorator.ts");

    // Check User entity content for emailVerifiedAt
    const userEntity = result.files.find(
      (f) => f.path === "src/users/entities/user.entity.ts",
    );
    expect(userEntity?.content).toContain("emailVerifiedAt?: Date | null;");
    expect(userEntity?.content).toContain("email_verified_at");

    // Check AuthController for reset & verification routes
    const authController = result.files.find(
      (f) => f.path === "src/auth/auth.controller.ts",
    );
    expect(authController?.content).toContain('@Post("forgot-password")');
    expect(authController?.content).toContain('@Post("reset-password")');
    expect(authController?.content).toContain('@Post("verify-email")');
    expect(authController?.content).toContain('@Post("resend-verification")');

    // Check AuthService for methods and TTL usage
    const authService = result.files.find(
      (f) => f.path === "src/auth/auth.service.ts",
    );
    expect(authService?.content).toContain("async forgotPassword");
    expect(authService?.content).toContain("async resetPassword");
    expect(authService?.content).toContain("async verifyEmail");
    expect(authService?.content).toContain("async resendVerification");
    expect(authService?.content).toContain('"30m"');
    expect(authService?.content).toContain('"48h"');

    // Check UsersModule for entity registration
    const usersModule = result.files.find(
      (f) => f.path === "src/users/users.module.ts",
    );
    expect(usersModule?.content).toContain("PasswordReset");
    expect(usersModule?.content).toContain("EmailVerification");

    // Check AuthModule imports MailModule
    const authModule = result.files.find(
      (f) => f.path === "src/auth/auth.module.ts",
    );
    expect(authModule?.content).toContain("MailModule");
    expect(authModule?.content).toContain("PasswordReset");
    expect(authModule?.content).toContain("EmailVerification");
  });

  it("does not emit mail or reset/verification files when flags are disabled", async () => {
    const project = createProject("Standard API");
    project.auth.passwordReset = false;
    project.auth.emailVerification = false;

    const result = await generateProject(project);
    const paths = result.files.map((file) => file.path);

    expect(paths).not.toContain("src/users/entities/password-reset.entity.ts");
    expect(paths).not.toContain("src/users/entities/email-verification.entity.ts");
    expect(paths).not.toContain("src/mail/mail.service.ts");
    expect(paths).not.toContain("src/mail/mail.module.ts");
    expect(paths).not.toContain("src/auth/dto/forgot-password.dto.ts");
    expect(paths).not.toContain("src/auth/dto/reset-password.dto.ts");
    expect(paths).not.toContain("src/auth/dto/verify-email.dto.ts");
    expect(paths).not.toContain("src/auth/dto/resend-verification.dto.ts");

    const userEntity = result.files.find(
      (f) => f.path === "src/users/entities/user.entity.ts",
    );
    expect(userEntity?.content).not.toContain("emailVerifiedAt");
  });

  describe("OAuth Providers (Google & GitHub)", () => {
    it("emits passport strategies, callback routes, nullable passwordHash, and env vars when OAuth is enabled", async () => {
      const project = createProject("OAuth API");
      project.auth.oauth = { google: true, github: true };

      const result = await generateProject(project);
      const paths = result.files.map((file) => file.path);

      // Strategy files
      expect(paths).toContain("src/auth/strategies/google.strategy.ts");
      expect(paths).toContain("src/auth/strategies/github.strategy.ts");

      // User entity has nullable passwordHash, googleId, githubId, avatarUrl
      const userEntity = result.files.find(
        (f) => f.path === "src/users/entities/user.entity.ts",
      );
      expect(userEntity?.content).toContain("passwordHash?: string | null;");
      expect(userEntity?.content).toContain("googleId?: string | null;");
      expect(userEntity?.content).toContain("githubId?: string | null;");
      expect(userEntity?.content).toContain("avatarUrl?: string | null;");

      // AuthController has OAuth initiation and callback endpoints
      const authController = result.files.find(
        (f) => f.path === "src/auth/auth.controller.ts",
      );
      expect(authController?.content).toContain('@Get("google")');
      expect(authController?.content).toContain('@Get("google/callback")');
      expect(authController?.content).toContain('@Get("github")');
      expect(authController?.content).toContain('@Get("github/callback")');

      // AuthService has validateOAuthLogin
      const authService = result.files.find(
        (f) => f.path === "src/auth/auth.service.ts",
      );
      expect(authService?.content).toContain("async validateOAuthLogin");

      // UsersService has OAuth helpers
      const usersService = result.files.find(
        (f) => f.path === "src/users/users.service.ts",
      );
      expect(usersService?.content).toContain("async findByOAuthId");
      expect(usersService?.content).toContain("async linkOAuthAccount");
      expect(usersService?.content).toContain("async createOAuthUser");

      // AuthModule registers strategies
      const authModule = result.files.find(
        (f) => f.path === "src/auth/auth.module.ts",
      );
      expect(authModule?.content).toContain("GoogleStrategy");
      expect(authModule?.content).toContain("GithubStrategy");

      // package.json dependencies
      const packageJson = result.files.find((f) => f.path === "package.json");
      expect(packageJson?.content).toContain('"passport-google-oauth20"');
      expect(packageJson?.content).toContain('"passport-github2"');
      expect(packageJson?.content).toContain('"@types/passport-google-oauth20"');
      expect(packageJson?.content).toContain('"@types/passport-github2"');

      // .env.example
      const envExample = result.files.find((f) => f.path === ".env.example");
      expect(envExample?.content).toContain("GOOGLE_CLIENT_ID=");
      expect(envExample?.content).toContain("GOOGLE_CALLBACK_URL=");
      expect(envExample?.content).toContain("GITHUB_CLIENT_ID=");
      expect(envExample?.content).toContain("GITHUB_CALLBACK_URL=");
    });

    it("does not emit strategies or oauth columns when oauth is disabled", async () => {
      const project = createProject("No OAuth API");
      project.auth.oauth = { google: false, github: false };

      const result = await generateProject(project);
      const paths = result.files.map((file) => file.path);

      expect(paths).not.toContain("src/auth/strategies/google.strategy.ts");
      expect(paths).not.toContain("src/auth/strategies/github.strategy.ts");

      const userEntity = result.files.find(
        (f) => f.path === "src/users/entities/user.entity.ts",
      );
      expect(userEntity?.content).toContain("passwordHash: string;");
      expect(userEntity?.content).not.toContain("googleId");
      expect(userEntity?.content).not.toContain("githubId");
      expect(userEntity?.content).not.toContain("avatarUrl");

      const authController = result.files.find(
        (f) => f.path === "src/auth/auth.controller.ts",
      );
      expect(authController?.content).not.toContain('@Get("google")');
      expect(authController?.content).not.toContain('@Get("github")');

      const envExample = result.files.find((f) => f.path === ".env.example");
      expect(envExample?.content).not.toContain("GOOGLE_CLIENT_ID");
      expect(envExample?.content).not.toContain("GITHUB_CLIENT_ID");
    });
  });

  describe("Two-Factor Authentication (2FA / TOTP)", () => {
    it("emits 2FA DTOs, entity fields, controller routes, service methods, and dependencies when enabled", async () => {
      const project = createProject("2FA API");
      project.auth.twoFactor = true;

      const result = await generateProject(project);
      const paths = result.files.map((file) => file.path);

      // DTOs
      expect(paths).toContain("src/auth/dto/two-factor-enable.dto.ts");
      expect(paths).toContain("src/auth/dto/two-factor-verify.dto.ts");
      expect(paths).toContain("src/auth/dto/two-factor-disable.dto.ts");

      // User entity has 2FA columns with select: false
      const userEntity = result.files.find(
        (f) => f.path === "src/users/entities/user.entity.ts",
      );
      expect(userEntity?.content).toContain("twoFactorSecret?: string | null;");
      expect(userEntity?.content).toContain("two_factor_secret");
      expect(userEntity?.content).toContain("twoFactorEnabled: boolean;");
      expect(userEntity?.content).toContain("two_factor_enabled");
      expect(userEntity?.content).toContain("twoFactorRecoveryCodes?: string[] | null;");
      expect(userEntity?.content).toContain("two_factor_recovery_codes");

      // AuthController has 2FA endpoints
      const authController = result.files.find(
        (f) => f.path === "src/auth/auth.controller.ts",
      );
      expect(authController?.content).toContain('@Post("2fa/generate")');
      expect(authController?.content).toContain('@Post("2fa/enable")');
      expect(authController?.content).toContain('@Post("2fa/disable")');
      expect(authController?.content).toContain('@Post("2fa/verify")');

      // AuthService has 2FA methods & step-up login
      const authService = result.files.find(
        (f) => f.path === "src/auth/auth.service.ts",
      );
      expect(authService?.content).toContain("async generateTwoFactor");
      expect(authService?.content).toContain("async enableTwoFactor");
      expect(authService?.content).toContain("async disableTwoFactor");
      expect(authService?.content).toContain("async verifyTwoFactor");
      expect(authService?.content).toContain("requiresTwoFactor: true");

      // UsersService has 2FA helper methods
      const usersService = result.files.find(
        (f) => f.path === "src/users/users.service.ts",
      );
      expect(usersService?.content).toContain("async findByIdWithTwoFactor");
      expect(usersService?.content).toContain("async setTwoFactorSecret");
      expect(usersService?.content).toContain("async enableTwoFactor");
      expect(usersService?.content).toContain("async disableTwoFactor");
      expect(usersService?.content).toContain("async consumeRecoveryCode");

      // package.json dependencies
      const packageJson = result.files.find((f) => f.path === "package.json");
      expect(packageJson?.content).toContain('"otplib": "^12.0.1"');
      expect(packageJson?.content).toContain('"qrcode": "^1.5.4"');
      expect(packageJson?.content).toContain('"@types/qrcode": "^1.5.5"');

      // .env.example
      const envExample = result.files.find((f) => f.path === ".env.example");
      expect(envExample?.content).toContain("TWO_FACTOR_APP_NAME=");
    });

    it("does not emit 2FA files, columns, or dependencies when twoFactor is false", async () => {
      const project = createProject("No 2FA API");
      project.auth.twoFactor = false;

      const result = await generateProject(project);
      const paths = result.files.map((file) => file.path);

      expect(paths).not.toContain("src/auth/dto/two-factor-enable.dto.ts");
      expect(paths).not.toContain("src/auth/dto/two-factor-verify.dto.ts");
      expect(paths).not.toContain("src/auth/dto/two-factor-disable.dto.ts");

      const userEntity = result.files.find(
        (f) => f.path === "src/users/entities/user.entity.ts",
      );
      expect(userEntity?.content).not.toContain("twoFactorSecret");
      expect(userEntity?.content).not.toContain("twoFactorEnabled");
      expect(userEntity?.content).not.toContain("twoFactorRecoveryCodes");

      const authController = result.files.find(
        (f) => f.path === "src/auth/auth.controller.ts",
      );
      expect(authController?.content).not.toContain("2fa/generate");
      expect(authController?.content).not.toContain("2fa/verify");

      const authService = result.files.find(
        (f) => f.path === "src/auth/auth.service.ts",
      );
      expect(authService?.content).not.toContain("generateTwoFactor");
      expect(authService?.content).not.toContain("requiresTwoFactor");

      const packageJson = result.files.find((f) => f.path === "package.json");
      expect(packageJson?.content).not.toContain('"otplib"');
      expect(packageJson?.content).not.toContain('"qrcode"');
      expect(packageJson?.content).not.toContain('"@types/qrcode"');

      const envExample = result.files.find((f) => f.path === ".env.example");
      expect(envExample?.content).not.toContain("TWO_FACTOR_APP_NAME");
    });
  });
});

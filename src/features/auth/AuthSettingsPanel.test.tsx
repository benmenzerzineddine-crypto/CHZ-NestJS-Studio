import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { AuthSettingsPanel } from "./AuthSettingsPanel";

describe("AuthSettingsPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
  });

  it("toggles basic authentication settings", () => {
    const project = createProject("Auth API");
    useProjectStore.getState().openProject(project);

    render(<AuthSettingsPanel />);

    const regToggle = screen.getByLabelText("Registration");
    expect(regToggle).toBeChecked();
    fireEvent.click(regToggle);
    expect(useProjectStore.getState().project?.auth.registerEnabled).toBe(false);

    const refreshTokensToggle = screen.getByLabelText("Refresh tokens");
    expect(refreshTokensToggle).toBeChecked();
    fireEvent.click(refreshTokensToggle);
    expect(useProjectStore.getState().project?.auth.refreshTokens).toBe(false);

    const seedAdminToggle = screen.getByLabelText("Seed admin");
    expect(seedAdminToggle).toBeChecked();
    fireEvent.click(seedAdminToggle);
    expect(useProjectStore.getState().project?.auth.seedAdmin).toBe(false);

    const adminEndpointsToggle = screen.getByLabelText("Admin user endpoints");
    expect(adminEndpointsToggle).toBeChecked();
    fireEvent.click(adminEndpointsToggle);
    expect(useProjectStore.getState().project?.auth.adminUserEndpoints).toBe(false);
  });

  it("toggles password reset and email verification with TTL fields", () => {
    const project = createProject("Auth API");
    useProjectStore.getState().openProject(project);

    render(<AuthSettingsPanel />);

    const pwResetToggle = screen.getByLabelText("Password reset");
    expect(pwResetToggle).not.toBeChecked();
    expect(screen.queryByLabelText("Password reset TTL")).not.toBeInTheDocument();

    fireEvent.click(pwResetToggle);
    expect(useProjectStore.getState().project?.auth.passwordReset).toBe(true);
    expect(screen.getByLabelText("Password reset TTL")).toBeInTheDocument();

    const emailVerifyToggle = screen.getByLabelText("Email verification");
    expect(emailVerifyToggle).not.toBeChecked();
    expect(screen.queryByLabelText("Email verification TTL")).not.toBeInTheDocument();

    fireEvent.click(emailVerifyToggle);
    expect(useProjectStore.getState().project?.auth.emailVerification).toBe(true);
    expect(screen.getByLabelText("Email verification TTL")).toBeInTheDocument();
  });

  it("renders OAuth 2.0 Providers section and toggles Google and GitHub providers", () => {
    const project = createProject("Auth API");
    useProjectStore.getState().openProject(project);

    render(<AuthSettingsPanel />);
    expect(screen.getByText("OAuth 2.0 Providers")).toBeInTheDocument();

    const googleToggle = screen.getByLabelText("Google OAuth");
    const githubToggle = screen.getByLabelText("GitHub OAuth");

    expect(googleToggle).not.toBeChecked();
    expect(githubToggle).not.toBeChecked();
    expect(screen.queryByText(/Google Callback URL:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GitHub Callback URL:/)).not.toBeInTheDocument();

    // Enable Google OAuth
    fireEvent.click(googleToggle);
    expect(useProjectStore.getState().project?.auth.oauth.google).toBe(true);
    expect(screen.getByText(/Google Callback URL:/)).toBeInTheDocument();
    expect(
      screen.getByText("http://localhost:3000/api/auth/google/callback"),
    ).toBeInTheDocument();

    // Enable GitHub OAuth
    fireEvent.click(githubToggle);
    expect(useProjectStore.getState().project?.auth.oauth.github).toBe(true);
    expect(screen.getByText(/GitHub Callback URL:/)).toBeInTheDocument();
    expect(
      screen.getByText("http://localhost:3000/api/auth/github/callback"),
    ).toBeInTheDocument();

    // Disable Google OAuth
    fireEvent.click(googleToggle);
    expect(useProjectStore.getState().project?.auth.oauth.google).toBe(false);
    expect(screen.queryByText(/Google Callback URL:/)).not.toBeInTheDocument();
  });

  it("toggles two-factor authentication (2FA)", () => {
    const project = createProject("Auth API");
    useProjectStore.getState().openProject(project);

    render(<AuthSettingsPanel />);
    const twoFactorToggle = screen.getByLabelText("Two-factor authentication (2FA)");
    expect(twoFactorToggle).not.toBeChecked();

    fireEvent.click(twoFactorToggle);
    expect(useProjectStore.getState().project?.auth.twoFactor).toBe(true);

    fireEvent.click(twoFactorToggle);
    expect(useProjectStore.getState().project?.auth.twoFactor).toBe(false);
  });

  it("manages roles and prevents admin deletion", () => {
    const project = createProject("Auth API");
    useProjectStore.getState().openProject(project);

    render(<AuthSettingsPanel />);

    // Admin role should be locked
    const adminKeyInput = screen.getByLabelText("Administrator role key");
    expect(adminKeyInput).toBeDisabled();
    expect(screen.getByLabelText("Remove Administrator")).toBeDisabled();

    // User role can be removed if not in use
    const removeUserBtn = screen.getByLabelText("Remove User");
    expect(removeUserBtn).not.toBeDisabled();
    fireEvent.click(removeUserBtn);

    expect(
      useProjectStore.getState().project?.auth.roles.some((r) => r.key === "user"),
    ).toBe(false);
  });
});

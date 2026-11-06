import { BufferedInput } from "@/components/ui/buffered-input";
import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import type { AuthConfig } from "@/core/model/schema";
import { cn } from "@/lib/cn";

export interface AuthVerificationSectionProps {
  auth: AuthConfig;
  locked: boolean;
  onUpdate: (updater: (draft: AuthConfig) => void) => void;
}

export function AuthVerificationSection({
  auth,
  locked,
  onUpdate,
}: AuthVerificationSectionProps) {
  return (
    <CardSection
      title="Account Security & Verification"
      description="Password reset flows, email verification, and two-factor authentication (2FA)."
      divide={false}
    >
      <fieldset
        disabled={locked}
        className={cn("divide-y divide-border", locked && "opacity-50")}
      >
        <ToggleRow
          label="Password reset"
          hint="Generate single-use token flows, /api/auth/forgot-password and /api/auth/reset-password."
          checked={auth.passwordReset}
          onCheckedChange={(passwordReset) =>
            onUpdate((draft) => { draft.passwordReset = passwordReset; })
          }
        />
        {auth.passwordReset ? (
          <FormRow
            label="Password reset TTL"
            hint="Expiry for reset tokens. Duration such as 1h or 30m."
            htmlFor="auth-reset-ttl"
          >
            <BufferedInput
              id="auth-reset-ttl"
              value={auth.passwordResetTtl}
              className="font-mono text-xs"
              transform={(value) => value.trim()}
              getError={(value) =>
                /^\d+[smhd]$/.test(value) ? null : "Use a duration such as 1h or 30m."
              }
              onCommit={(value) => onUpdate((draft) => { draft.passwordResetTtl = value; })}
            />
          </FormRow>
        ) : null}

        <ToggleRow
          label="Email verification"
          hint="Generate verification tokens, emailVerifiedAt timestamp on User, and verification endpoints."
          checked={auth.emailVerification}
          onCheckedChange={(emailVerification) =>
            onUpdate((draft) => { draft.emailVerification = emailVerification; })
          }
        />
        {auth.emailVerification ? (
          <FormRow
            label="Email verification TTL"
            hint="Expiry for verification tokens. Duration such as 24h or 7d."
            htmlFor="auth-verify-ttl"
          >
            <BufferedInput
              id="auth-verify-ttl"
              value={auth.emailVerificationTtl}
              className="font-mono text-xs"
              transform={(value) => value.trim()}
              getError={(value) =>
                /^\d+[smhd]$/.test(value) ? null : "Use a duration such as 24h or 7d."
              }
              onCommit={(value) =>
                onUpdate((draft) => { draft.emailVerificationTtl = value; })
              }
            />
          </FormRow>
        ) : null}

        <ToggleRow
          label="Two-factor authentication (2FA)"
          hint="TOTP authenticator app support with backup recovery codes, /auth/2fa routes, and step-up login verification."
          checked={auth.twoFactor}
          onCheckedChange={(twoFactor) =>
            onUpdate((draft) => { draft.twoFactor = twoFactor; })
          }
        />
      </fieldset>
    </CardSection>
  );
}

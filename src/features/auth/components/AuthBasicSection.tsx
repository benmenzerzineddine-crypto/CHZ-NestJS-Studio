import { BufferedInput } from "@/components/ui/buffered-input";
import { CardSection } from "@/components/ui/card-section";
import { FormRow, ToggleRow } from "@/components/ui/form-row";
import type { AuthConfig } from "@/core/model/schema";
import { cn } from "@/lib/cn";

export interface AuthBasicSectionProps {
  auth: AuthConfig;
  locked: boolean;
  onUpdate: (updater: (draft: AuthConfig) => void) => void;
}

export function AuthBasicSection({ auth, locked, onUpdate }: AuthBasicSectionProps) {
  return (
    <CardSection
      title="Authentication"
      description="JWT access tokens and rotating refresh tokens. Changes save automatically."
      divide={false}
    >
      <ToggleRow
        label="Enabled"
        hint="Disabling authentication removes guards from generated routes and ignores the access matrix."
        checked={auth.enabled}
        onCheckedChange={(enabled) => onUpdate((draft) => { draft.enabled = enabled; })}
      />

      <fieldset
        disabled={locked}
        className={cn("divide-y divide-border", locked && "opacity-50")}
      >
        <ToggleRow
          label="Registration"
          hint="Expose POST /auth/register. Disable for invite-only deployments."
          checked={auth.registerEnabled}
          onCheckedChange={(registerEnabled) =>
            onUpdate((draft) => { draft.registerEnabled = registerEnabled; })
          }
        />
        <ToggleRow
          label="Refresh tokens"
          hint="Issue rotating refresh tokens stored hashed in refresh_tokens."
          checked={auth.refreshTokens}
          onCheckedChange={(refreshTokens) =>
            onUpdate((draft) => {
              draft.refreshTokens = refreshTokens;
              if (!refreshTokens) {
                draft.sessionManagement = false;
              }
            })
          }
        />
        <ToggleRow
          label="Session management"
          hint="Track active sessions with IP and User-Agent, and allow remote revocation."
          checked={auth.sessionManagement ?? false}
          disabled={!auth.refreshTokens}
          onCheckedChange={(sessionManagement) =>
            onUpdate((draft) => { draft.sessionManagement = sessionManagement; })
          }
        />
        <ToggleRow
          label="Seed admin"
          hint="Generate a seed script using the ADMIN_EMAIL and ADMIN_PASSWORD environment variables."
          checked={auth.seedAdmin}
          onCheckedChange={(seedAdmin) => onUpdate((draft) => { draft.seedAdmin = seedAdmin; })}
        />
        <ToggleRow
          label="Admin user endpoints"
          hint="Expose GET /users, role assignment, and admin-only user deletion."
          checked={auth.adminUserEndpoints}
          onCheckedChange={(adminUserEndpoints) =>
            onUpdate((draft) => { draft.adminUserEndpoints = adminUserEndpoints; })
          }
        />

        <FormRow
          label="Access token TTL"
          hint="Short-lived. Duration such as 15m or 1h."
          htmlFor="auth-access-ttl"
        >
          <BufferedInput
            id="auth-access-ttl"
            value={auth.accessTokenTtl}
            className="font-mono text-xs"
            transform={(value) => value.trim()}
            getError={(value) =>
              /^\d+[smhd]$/.test(value) ? null : "Use a duration such as 15m or 7d."
            }
            onCommit={(value) => onUpdate((draft) => { draft.accessTokenTtl = value; })}
          />
        </FormRow>

        <FormRow
          label="Refresh token TTL"
          hint="Rotated on every refresh. Duration such as 7d or 24h."
          htmlFor="auth-refresh-ttl"
        >
          <BufferedInput
            id="auth-refresh-ttl"
            value={auth.refreshTokenTtl}
            className="font-mono text-xs"
            transform={(value) => value.trim()}
            getError={(value) =>
              /^\d+[smhd]$/.test(value) ? null : "Use a duration such as 15m or 7d."
            }
            onCommit={(value) => onUpdate((draft) => { draft.refreshTokenTtl = value; })}
          />
        </FormRow>

        <FormRow
          label="Password minimum"
          hint="Bcrypt supports 6–72 characters; the seed validates this value."
          htmlFor="auth-password-min"
        >
          <BufferedInput
            id="auth-password-min"
            type="number"
            min={6}
            max={72}
            value={String(auth.passwordMinLength)}
            transform={(value) => value.trim()}
            getError={(value) => {
              const parsed = Number(value);
              return Number.isInteger(parsed) && parsed >= 6 && parsed <= 72
                ? null
                : "Use a whole number from 6 to 72.";
            }}
            onCommit={(value) =>
              onUpdate((draft) => { draft.passwordMinLength = Number(value); })
            }
          />
        </FormRow>
      </fieldset>
    </CardSection>
  );
}

import { CardSection } from "@/components/ui/card-section";
import { ToggleRow } from "@/components/ui/form-row";
import type { AuthConfig } from "@/core/model/schema";
import { cn } from "@/lib/cn";

export interface AuthOAuthSectionProps {
  auth: AuthConfig;
  apiPrefix: string;
  locked: boolean;
  onUpdate: (updater: (draft: AuthConfig) => void) => void;
}

export function AuthOAuthSection({
  auth,
  apiPrefix,
  locked,
  onUpdate,
}: AuthOAuthSectionProps) {
  return (
    <CardSection
      title="OAuth 2.0 Providers"
      description="Enable third-party authentication with Google and GitHub. Generates Passport strategies and callback routes."
      divide={false}
    >
      <fieldset
        disabled={locked}
        className={cn("divide-y divide-border", locked && "opacity-50")}
      >
        <ToggleRow
          label="Google OAuth"
          hint="Expose GET /auth/google and GET /auth/google/callback via passport-google-oauth20."
          checked={auth.oauth?.google ?? false}
          onCheckedChange={(google) =>
            onUpdate((draft) => {
              draft.oauth = { ...draft.oauth, google };
            })
          }
        />
        {auth.oauth?.google ? (
          <div className="bg-surface-elevated/40 px-5 py-3 text-xs text-muted">
            <span className="font-medium text-foreground">Google Callback URL:</span>{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-accent">
              http://localhost:3000/{apiPrefix}/auth/google/callback
            </code>
          </div>
        ) : null}

        <ToggleRow
          label="GitHub OAuth"
          hint="Expose GET /auth/github and GET /auth/github/callback via passport-github2."
          checked={auth.oauth?.github ?? false}
          onCheckedChange={(github) =>
            onUpdate((draft) => {
              draft.oauth = { ...draft.oauth, github };
            })
          }
        />
        {auth.oauth?.github ? (
          <div className="bg-surface-elevated/40 px-5 py-3 text-xs text-muted">
            <span className="font-medium text-foreground">GitHub Callback URL:</span>{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-accent">
              http://localhost:3000/{apiPrefix}/auth/github/callback
            </code>
          </div>
        ) : null}
      </fieldset>
    </CardSection>
  );
}

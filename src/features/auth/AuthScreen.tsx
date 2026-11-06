import { AlertTriangle } from "lucide-react";
import { useProjectStore } from "@/store/project.store";
import { AccessMatrix } from "./AccessMatrix";
import { AuthSettingsPanel } from "./AuthSettingsPanel";

export function AuthScreen() {
  const project = useProjectStore((state) => state.project);

  if (!project) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Authentication &amp; authorization
        </h1>
        <p className="mt-1 text-sm text-muted">
          JWT auth, roles, and per-operation access rules. The generator emits guards from this
          configuration.
        </p>
      </header>

      {!project.auth.enabled ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-foreground">Authentication is disabled</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              Generated routes will not be guarded and the access matrix is ignored. Your rules are
              kept and take effect again when you re-enable authentication.
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        <AuthSettingsPanel />
        <AccessMatrix />
      </div>
    </div>
  );
}

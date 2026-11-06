import { useProjectStore } from "@/store/project.store";
import { AuthBasicSection } from "./components/AuthBasicSection";
import { AuthOAuthSection } from "./components/AuthOAuthSection";
import { AuthRolesSection } from "./components/AuthRolesSection";
import { AuthVerificationSection } from "./components/AuthVerificationSection";

export function AuthSettingsPanel() {
  const project = useProjectStore((state) => state.project);
  const updateAuth = useProjectStore((state) => state.updateAuth);

  if (!project) return null;

  const auth = project.auth;
  const locked = !auth.enabled;

  return (
    <div className="space-y-5">
      <AuthBasicSection
        auth={auth}
        locked={locked}
        onUpdate={updateAuth}
      />

      <AuthVerificationSection
        auth={auth}
        locked={locked}
        onUpdate={updateAuth}
      />

      <AuthOAuthSection
        auth={auth}
        apiPrefix={project.settings.apiPrefix}
        locked={locked}
        onUpdate={updateAuth}
      />

      <AuthRolesSection
        roles={auth.roles}
        project={project}
        locked={locked}
      />
    </div>
  );
}

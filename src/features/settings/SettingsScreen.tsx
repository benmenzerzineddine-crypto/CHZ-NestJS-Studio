import { useProjectStore } from "@/store/project.store";
import { DatabaseSettingsSection } from "./components/DatabaseSettingsSection";
import { GraphQLSettingsSection } from "./components/GraphQLSettingsSection";
import { MultitenancySettingsSection } from "./components/MultitenancySettingsSection";
import { ProjectSettingsSection } from "./components/ProjectSettingsSection";
import { QueuesSettingsSection } from "./components/QueuesSettingsSection";
import { StorageSettingsSection } from "./components/StorageSettingsSection";
import { ThrottlingSettingsSection } from "./components/ThrottlingSettingsSection";
import { WebSocketsSettingsSection } from "./components/WebSocketsSettingsSection";

export function SettingsScreen() {
  const project = useProjectStore((state) => state.project);
  const updateProject = useProjectStore((state) => state.updateProject);

  if (!project) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Project-level configuration. Changes save automatically.
        </p>
      </header>

      <div className="space-y-5">
        <ProjectSettingsSection project={project} onUpdate={updateProject}>
          <DatabaseSettingsSection driver={project.driver} onUpdate={updateProject} />
        </ProjectSettingsSection>

        <StorageSettingsSection uploads={project.settings.uploads} onUpdate={updateProject} />

        <MultitenancySettingsSection multitenancy={project.settings.multitenancy} onUpdate={updateProject} />

        <ThrottlingSettingsSection throttling={project.settings.throttling} onUpdate={updateProject} />

        <GraphQLSettingsSection graphql={project.settings.graphql} onUpdate={updateProject} />
        <WebSocketsSettingsSection websockets={project.settings.websockets} onUpdate={updateProject} />
        <QueuesSettingsSection queues={project.settings.queues} onUpdate={updateProject} />
      </div>
    </div>
  );
}

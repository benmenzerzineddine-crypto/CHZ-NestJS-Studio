import {
  BookOpen,
  ChevronLeft,
  FolderOpen,
  Route,
  Settings2,
  ShieldCheck,
  Sparkles,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationPanel } from "@/features/validation/ValidationPanel";
import { DRIVER_LABELS } from "@/lib/drivers";
import { cn } from "@/lib/cn";
import { useProjectStore } from "@/store/project.store";
import { useUiStore, type Screen } from "@/store/ui.store";

interface NavItem {
  screen: Exclude<Screen, "projects">;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { screen: "settings", label: "Settings", icon: Settings2 },
  { screen: "entities", label: "Entities", icon: Boxes },
  { screen: "auth", label: "Auth", icon: ShieldCheck },
  { screen: "endpoints", label: "Endpoints", icon: Route },
  { screen: "generate", label: "Generate", icon: Sparkles },
  { screen: "documentation", label: "Documentation", icon: BookOpen },
];

export function Sidebar() {
  const project = useProjectStore((state) => state.project);
  const closeProject = useProjectStore((state) => state.closeProject);
  const screen = useUiStore((state) => state.screen);
  const setScreen = useUiStore((state) => state.setScreen);

  if (!project) return null;

  async function handleAllProjects() {
    const closed = await closeProject();
    if (closed) setScreen("projects");
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface/60 p-3">
      <nav className="space-y-1" aria-label="Project sections">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = screen === item.screen;
          return (
            <button
              key={item.screen}
              type="button"
              onClick={() => setScreen(item.screen)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                active
                  ? "bg-accent/10 text-foreground"
                  : "text-muted hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-muted")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <ValidationPanel />

        <div className="rounded-lg border border-border bg-canvas/60 p-3">
          <p className="truncate text-xs font-medium text-foreground">{project.name}</p>
          <p className="mt-1 text-[11px] text-muted">
            {DRIVER_LABELS[project.driver]} · {project.entities.length}{" "}
            {project.entities.length === 1 ? "entity" : "entities"}
          </p>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => void handleAllProjects()}
        >
          <ChevronLeft className="h-4 w-4" />
          <FolderOpen className="h-4 w-4" />
          All projects
        </Button>
      </div>
    </aside>
  );
}

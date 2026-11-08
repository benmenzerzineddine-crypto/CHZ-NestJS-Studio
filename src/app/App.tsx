import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { EntitiesScreen } from "@/features/designer/EntitiesScreen";
import { EndpointsScreen } from "@/features/endpoints/EndpointsScreen";
import { ProjectsScreen } from "@/features/projects/ProjectsScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { useAutosave } from "@/store/autosave";
import {
  redoProject,
  undoProject,
  useProjectStore,
} from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { useGenerateStore } from "@/store/generate.store";
import blogJson from "@/core/fixtures/blog.json";
import { AppHeader } from "./AppHeader";
import { Sidebar } from "./Sidebar";
import { useWindowState } from "./use-window-state";

const DocumentationScreen = lazy(async () => {
  const module = await import("@/features/docs/DocumentationScreen");
  return { default: module.DocumentationScreen };
});
const PreviewScreen = lazy(async () => {
  const module = await import("@/features/preview/PreviewScreen");
  return { default: module.PreviewScreen };
});

function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (key === "s") {
        event.preventDefault();
        void useProjectStore.getState().saveNow();
        return;
      }

      if (editing) return;

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoProject();
        return;
      }

      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redoProject();
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        void useGenerateStore.getState().run();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function useUnsavedChangesGuard(): void {
  const status = useProjectStore((state) => state.status);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (status !== "dirty" && status !== "error") return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function setup() {
      if (!("__TAURI_INTERNALS__" in window)) return;
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const stop = await getCurrentWindow().onCloseRequested(async (event) => {
        const current = useProjectStore.getState().status;
        if (current !== "dirty" && current !== "error") return;
        const saved = await useProjectStore.getState().saveNow();
        if (!saved) event.preventDefault();
      });
      if (cancelled) stop();
      else unlisten = stop;
    }

    void setup();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}

function ScreenRouter() {
  const project = useProjectStore((state) => state.project);
  const screen = useUiStore((state) => state.screen);

  if (screen === "documentation") {
    return <DocumentationScreen />;
  }

  if (!project) return <ProjectsScreen />;

  switch (screen) {
    case "settings":
      return <SettingsScreen />;
    case "entities":
      return <EntitiesScreen />;
    case "auth":
      return <AuthScreen />;
    case "endpoints":
      return <EndpointsScreen />;
    case "generate":
      return <PreviewScreen />;
    default:
      return <ProjectsScreen />;
  }
}

export default function App() {
  useAutosave();
  useKeyboardShortcuts();
  useUnsavedChangesGuard();
  useWindowState();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const screenParam = params.get("screen");
    const demo = params.get("demo");
    if (demo || screenParam) {
      if (!useProjectStore.getState().project) {
        useProjectStore.getState().openProject(blogJson as any);
      }
      if (!useGenerateStore.getState().result) {
        void useGenerateStore.getState().run({ silent: true });
      }
      if (screenParam) {
        useUiStore.getState().setScreen(screenParam as any);
      }
      const scroll = params.get("scroll");
      if (scroll) {
        const doScroll = () => {
          if (scroll === "bottom") {
            const main = document.querySelector("main");
            if (main) main.scrollTop = main.scrollHeight;
          } else {
            const el = document.getElementById(scroll) || document.querySelector(scroll);
            el?.scrollIntoView({ behavior: "instant" });
          }
        };
        doScroll();
        setTimeout(doScroll, 50);
      }
    }
  }, []);

  const project = useProjectStore((state) => state.project);

  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex h-screen flex-col overflow-hidden bg-canvas text-foreground">
        <AppHeader />
        <div className="flex min-h-0 flex-1">
          {project ? <Sidebar /> : null}
          <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Loading…
                </div>
              }
            >
              <ScreenRouter />
            </Suspense>
          </main>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

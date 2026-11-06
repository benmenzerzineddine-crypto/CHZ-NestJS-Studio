import { ArrowLeft, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { DOC_SECTIONS } from "./doc-sections";

export function DocumentationScreen() {
  const project = useProjectStore((state) => state.project);
  const setScreen = useUiStore((state) => state.setScreen);
  const [search, setSearch] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string>("overview");

  const filteredSections = useMemo(() => {
    if (!search.trim()) return DOC_SECTIONS;
    const query = search.toLowerCase();
    return DOC_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.summary.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query),
    );
  }, [search]);

  const activeSection =
    DOC_SECTIONS.find((s) => s.id === activeSectionId) || DOC_SECTIONS[0];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-6 py-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScreen(project ? "settings" : "projects")}
          >
            <ArrowLeft className="h-4 w-4" />
            {project ? "Back to Project" : "Back to Projects"}
          </Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Documentation</h1>
              <p className="text-[11px] text-muted">Complete guide to using chz-nest studio and CLI</p>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search documentation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Main Documentation Layout */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-12">
        {/* Navigation Sidebar */}
        <aside className="space-y-1 overflow-y-auto pr-2 md:col-span-4 lg:col-span-3 scrollbar-thin">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Topics ({filteredSections.length})
          </p>
          {filteredSections.map((section) => {
            const Icon = section.icon;
            const active = section.id === activeSection.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSectionId(section.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  active
                    ? "border border-accent/30 bg-accent/10 text-foreground"
                    : "border border-transparent text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-accent" : "text-muted"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-medium text-foreground">{section.title}</p>
                    {section.badge ? (
                      <Badge variant="accent" className="text-[9px] py-0 px-1.5">
                        {section.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">{section.summary}</p>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Content Viewer */}
        <main className="overflow-y-auto pr-2 md:col-span-8 lg:col-span-9 scrollbar-thin">
          <CardSection
            title={
              <div className="flex items-center gap-2">
                <activeSection.icon className="h-5 w-5 text-accent" />
                <span>{activeSection.title}</span>
                {activeSection.badge ? (
                  <Badge variant="accent">{activeSection.badge}</Badge>
                ) : null}
              </div>
            }
            description={activeSection.summary}
            className="bg-surface/80"
          >
            <div className="p-6">
              {activeSection.render()}
            </div>
          </CardSection>
        </main>
      </div>
    </div>
  );
}

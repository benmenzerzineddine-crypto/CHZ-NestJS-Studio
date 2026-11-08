import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  Layers,
  LayoutTemplate,
  Loader2,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toPackageName } from "@/core/model/defaults";
import type { Driver, Project } from "@/core/model/schema";
import {
  PROJECT_TEMPLATES,
  type ProjectTemplate,
  type TemplateCategory,
} from "@/core/templates";
import { DRIVER_OPTIONS } from "@/lib/drivers";
import { errorMessage } from "@/lib/tauri";

interface TemplatesGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (project: Project) => Promise<void>;
}

const CATEGORY_TABS: Array<{ id: "all" | TemplateCategory; label: string }> = [
  { id: "all", label: "All Templates" },
  { id: "saas", label: "SaaS" },
  { id: "ecommerce", label: "E-Commerce" },
  { id: "crm", label: "CRM" },
  { id: "cms", label: "CMS & Blog" },
];

function getTemplateIcon(icon: string) {
  switch (icon) {
    case "Layers":
      return Layers;
    case "ShoppingBag":
      return ShoppingBag;
    case "Building2":
      return Building2;
    case "FileText":
      return FileText;
    default:
      return LayoutTemplate;
  }
}

export function TemplatesGalleryDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplatesGalleryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | TemplateCategory>("all");
  const [search, setSearch] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<ProjectTemplate | null>(null);

  // Customization state for active template
  const [projectName, setProjectName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [packageEdited, setPackageEdited] = useState(false);
  const [driver, setDriver] = useState<Driver>("postgres");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    return PROJECT_TEMPLATES.filter((template) => {
      const matchesCategory =
        selectedCategory === "all" || template.category === selectedCategory;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        template.title.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.entities.some((e) => e.toLowerCase().includes(term)) ||
        template.features.some((f) => f.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search]);

  function handleStartCustomize(template: ProjectTemplate) {
    setActiveTemplate(template);
    setProjectName(template.title);
    setPackageName(toPackageName(template.title));
    setPackageEdited(false);
    setDriver("postgres");
    setError(null);
  }

  function handleBackToGallery() {
    setActiveTemplate(null);
    setError(null);
  }

  async function handleCreateFromTemplate() {
    if (!activeTemplate) return;
    const finalName = projectName.trim() || activeTemplate.title;
    const finalPackage = packageName.trim() || toPackageName(finalName);

    setPending(true);
    setError(null);
    try {
      const project = activeTemplate.createProject({
        name: finalName,
        packageName: finalPackage,
        driver,
      });
      await onSelectTemplate(project);
      onOpenChange(false);
      setActiveTemplate(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setActiveTemplate(null);
          setError(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Project Templates Gallery</DialogTitle>
                <DialogDescription>
                  Jumpstart your NestJS API with battle-tested architectures.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {activeTemplate ? (
          /* Configure template step */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <button
              type="button"
              onClick={handleBackToGallery}
              className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to all templates
            </button>

            <div className="rounded-xl border border-border bg-surface-raised/40 p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-border bg-surface p-2.5 text-foreground">
                  {(() => {
                    const IconComponent = getTemplateIcon(activeTemplate.icon);
                    return <IconComponent className="h-5 w-5" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {activeTemplate.title}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {activeTemplate.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeTemplate.entities.map((entity) => (
                      <span
                        key={entity}
                        className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-mono text-muted"
                      >
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="template-project-name">Project name</Label>
                <Input
                  id="template-project-name"
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    if (!packageEdited) {
                      setPackageName(toPackageName(e.target.value));
                    }
                  }}
                  placeholder={activeTemplate.title}
                  maxLength={80}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="template-package-name">Package name</Label>
                  <Input
                    id="template-package-name"
                    value={packageName}
                    onChange={(e) => {
                      setPackageEdited(true);
                      setPackageName(e.target.value);
                    }}
                    placeholder="my-api"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-driver">Database</Label>
                  <Select
                    id="template-driver"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value as Driver)}
                  >
                    {DRIVER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface-raised p-3.5 space-y-1">
                <p className="text-xs font-medium text-foreground">Included Highlights:</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {activeTemplate.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-1.5 text-xs text-muted">
                      <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error ? <p className="text-xs text-danger">{error}</p> : null}
            </div>

            <DialogFooter className="mt-8 border-t border-border pt-4">
              <Button variant="ghost" onClick={handleBackToGallery}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateFromTemplate}
                disabled={pending || !projectName.trim()}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating project…
                  </>
                ) : (
                  "Create project"
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Templates Gallery Grid */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORY_TABS.map((tab) => {
                  const active = selectedCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedCategory(tab.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "border border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates…"
                  aria-label="Search templates"
                  className="pl-8 text-xs"
                />
              </div>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted">
                No templates matched your search query.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredTemplates.map((template) => {
                  const IconComponent = getTemplateIcon(template.icon);
                  return (
                    <div
                      key={template.id}
                      className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-black/20"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="rounded-lg border border-border bg-surface-raised p-2 text-foreground group-hover:border-accent/30 group-hover:text-accent">
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">
                                {template.title}
                              </h3>
                              <p className="text-[11px] text-muted">
                                {template.tagline}
                              </p>
                            </div>
                          </div>
                          <Badge variant="accent" className="capitalize">
                            {template.category}
                          </Badge>
                        </div>

                        <p className="mt-3 text-xs leading-relaxed text-muted line-clamp-2">
                          {template.description}
                        </p>

                        <div className="mt-3">
                          <p className="text-[11px] font-medium text-foreground mb-1.5">
                            Entities:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {template.entities.map((entity) => (
                              <span
                                key={entity}
                                className="rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-muted"
                              >
                                {entity}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 space-y-1">
                          {template.features.slice(0, 3).map((feature) => (
                            <div
                              key={feature}
                              className="flex items-center gap-1.5 text-[11px] text-muted"
                            >
                              <Check className="h-3 w-3 text-accent shrink-0" />
                              <span className="truncate">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border pt-3 flex items-center justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleStartCustomize(template)}
                          className="w-full sm:w-auto"
                        >
                          Use template
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { Boxes, LayoutTemplate, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyProjectsStateProps {
  onImportClick: () => void;
  onCreateClick: () => void;
  onTemplatesClick?: () => void;
}

export function EmptyProjectsState({
  onImportClick,
  onCreateClick,
  onTemplatesClick,
}: EmptyProjectsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-20 text-center">
      <div className="mb-4 rounded-full border border-border bg-surface-raised p-3">
        <Boxes className="h-6 w-6 text-muted" />
      </div>
      <h2 className="text-base font-medium text-foreground">No projects yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Start with a data model. Authentication, CRUD endpoints and the full
        NestJS project are generated from it.
      </p>
      <div className="mt-5 flex items-center gap-2">
        {onTemplatesClick ? (
          <Button variant="secondary" onClick={onTemplatesClick}>
            <LayoutTemplate className="h-4 w-4" />
            Explore templates
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onImportClick}>
          <Sparkles className="h-4 w-4" />
          Import schema
        </Button>
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4" />
          Create your first project
        </Button>
      </div>
    </div>
  );
}

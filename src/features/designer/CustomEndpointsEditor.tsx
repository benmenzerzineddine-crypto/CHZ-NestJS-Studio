import { Pencil, Plus, Route, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { MethodBadge } from "@/components/ui/method-badge";
import type { CustomEndpointDef, EntityDef } from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { CustomEndpointDialog } from "./components/CustomEndpointDialog";

interface CustomEndpointsEditorProps {
  entity: EntityDef;
}

export function CustomEndpointsEditor({ entity }: CustomEndpointsEditorProps) {
  const project = useProjectStore((state) => state.project);
  const deleteCustomEndpoint = useProjectStore((state) => state.deleteCustomEndpoint);
  const pushToast = useUiStore((state) => state.pushToast);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomEndpointDef | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomEndpointDef | null>(null);

  if (!project) return null;

  const endpoints = entity.customEndpoints ?? [];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(endpoint: CustomEndpointDef) {
    setEditing(endpoint);
    setDialogOpen(true);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteCustomEndpoint(entity.id, pendingDelete.id);
    pushToast({
      kind: "info",
      title: "Endpoint removed",
      message: `${pendingDelete.method} ${pendingDelete.path} was deleted.`,
    });
    setPendingDelete(null);
  }

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Custom Endpoints</h2>
          <p className="mt-0.5 text-xs text-muted">
            Custom HTTP routes emitted into NestJS controllers and services with typed stubs.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add endpoint
        </Button>
      </header>

      {endpoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <Route className="h-6 w-6 text-muted/60" />
          <p className="text-xs text-muted">No custom endpoints defined for this entity.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-raised/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method={ep.method} />
                <span className="font-mono text-xs text-foreground">{ep.path}</span>
                <span className="text-[11px] font-mono text-muted">→ {ep.name}()</span>
                <Badge variant={ep.access.level === "public" ? "warning" : "default"}>
                  {ep.access.level}
                  {ep.access.level === "roles" && ep.access.roles?.length
                    ? ` (${ep.access.roles.join(", ")})`
                    : ""}
                </Badge>
                {ep.skipThrottle ? <Badge variant="warning">No throttle</Badge> : null}
                {ep.throttle ? (
                  <Badge variant="default">
                    Rate: {ep.throttle.limit}/{ep.throttle.ttl}s
                  </Badge>
                ) : null}
                {ep.cache && ep.method === "GET" ? (
                  <Badge variant="accent">
                    Cache: {ep.cache.maxAge}s
                  </Badge>
                ) : null}
                {ep.description ? (
                  <span className="text-xs text-muted">· {ep.description}</span>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => openEdit(ep)}
                  aria-label={`Edit ${ep.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted hover:text-danger"
                  onClick={() => setPendingDelete(ep)}
                  aria-label={`Delete ${ep.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomEndpointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entity={entity}
        project={project}
        endpoint={editing}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete custom endpoint"
        description={`Remove ${pendingDelete?.method} ${pendingDelete?.path} (${pendingDelete?.name})? This cannot be undone after closing the project.`}
        confirmLabel="Delete endpoint"
        onConfirm={confirmDelete}
      />
    </section>
  );
}

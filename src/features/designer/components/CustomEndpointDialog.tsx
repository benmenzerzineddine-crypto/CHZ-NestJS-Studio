import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CustomEndpointDef,
  EntityDef,
  Project,
} from "@/core/model/schema";
import { EndpointAccessSection } from "./EndpointAccessSection";
import { EndpointCacheSection } from "./EndpointCacheSection";
import { EndpointRouteFields } from "./EndpointRouteFields";
import { EndpointThrottleSection } from "./EndpointThrottleSection";
import { useCustomEndpointForm } from "./useCustomEndpointForm";

export interface CustomEndpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EntityDef;
  project: Project;
  endpoint: CustomEndpointDef | null;
}

export function CustomEndpointDialog({
  open,
  onOpenChange,
  entity,
  project,
  endpoint,
}: CustomEndpointDialogProps) {
  const form = useCustomEndpointForm(entity, endpoint, open, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{endpoint ? "Edit custom endpoint" : "Add custom endpoint"}</DialogTitle>
          <DialogDescription>
            Configure the HTTP route, method, and access rule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {form.error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
              {form.error}
            </div>
          ) : null}

          <EndpointRouteFields
            method={form.method}
            onMethodChange={form.setMethod}
            path={form.path}
            onPathChange={form.handlePathChange}
            name={form.name}
            onNameChange={form.setName}
            description={form.description}
            onDescriptionChange={form.setDescription}
          />

          <EndpointAccessSection
            accessLevel={form.accessLevel}
            onAccessLevelChange={form.setAccessLevel}
            roles={project.auth.roles}
            selectedRoles={form.selectedRoles}
            onToggleRole={form.toggleRole}
            hasOwnerOption={Boolean(entity.options.owner)}
            entityName={entity.name}
          />

          <EndpointThrottleSection
            throttleMode={form.throttleMode}
            onThrottleModeChange={form.setThrottleMode}
            throttleLimit={form.throttleLimit}
            onThrottleLimitChange={form.setThrottleLimit}
            throttleTtl={form.throttleTtl}
            onThrottleTtlChange={form.setThrottleTtl}
          />

          {form.method === "GET" ? (
            <EndpointCacheSection
              enableCache={form.enableCache}
              onEnableCacheChange={form.setEnableCache}
              cacheMaxAge={form.cacheMaxAge}
              onCacheMaxAgeChange={form.setCacheMaxAge}
              cacheScope={form.cacheScope}
              onCacheScopeChange={form.setCacheScope}
              cacheSharedMaxAge={form.cacheSharedMaxAge}
              onCacheSharedMaxAgeChange={form.setCacheSharedMaxAge}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={form.handleSubmit}>
            {endpoint ? "Save changes" : "Add endpoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

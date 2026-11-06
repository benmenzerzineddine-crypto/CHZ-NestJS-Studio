import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCustomEndpoint } from "@/core/model/defaults";
import { toCamelCase } from "@/core/model/naming";
import type {
  AccessLevel,
  CustomEndpointDef,
  EntityDef,
  HttpMethod,
  Project,
} from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { EndpointAccessSection } from "./EndpointAccessSection";
import { EndpointCacheSection, type CacheScope } from "./EndpointCacheSection";
import { EndpointRouteFields } from "./EndpointRouteFields";
import { EndpointThrottleSection, type ThrottleMode } from "./EndpointThrottleSection";

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
  const addCustomEndpoint = useProjectStore((state) => state.addCustomEndpoint);
  const updateCustomEndpoint = useProjectStore((state) => state.updateCustomEndpoint);
  const pushToast = useUiStore((state) => state.pushToast);

  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("authenticated");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [throttleMode, setThrottleMode] = useState<ThrottleMode>("default");
  const [throttleLimit, setThrottleLimit] = useState(10);
  const [throttleTtl, setThrottleTtl] = useState(60);
  const [enableCache, setEnableCache] = useState(false);
  const [cacheMaxAge, setCacheMaxAge] = useState(60);
  const [cacheScope, setCacheScope] = useState<CacheScope>("public");
  const [cacheSharedMaxAge, setCacheSharedMaxAge] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (endpoint) {
      setMethod(endpoint.method);
      setPath(endpoint.path);
      setName(endpoint.name);
      setDescription(endpoint.description ?? "");
      setAccessLevel(endpoint.access.level);
      setSelectedRoles(endpoint.access.roles ?? []);
      setThrottleMode(endpoint.skipThrottle ? "skip" : endpoint.throttle ? "custom" : "default");
      setThrottleLimit(endpoint.throttle?.limit ?? 10);
      setThrottleTtl(endpoint.throttle?.ttl ?? 60);
      setEnableCache(Boolean(endpoint.cache));
      setCacheMaxAge(endpoint.cache?.maxAge ?? 60);
      setCacheScope(endpoint.cache?.scope ?? "public");
      setCacheSharedMaxAge(endpoint.cache?.sharedMaxAge ? String(endpoint.cache.sharedMaxAge) : "");
    } else {
      setMethod("GET");
      setPath("");
      setName("");
      setDescription("");
      setAccessLevel("authenticated");
      setSelectedRoles([]);
      setThrottleMode("default");
      setThrottleLimit(10);
      setThrottleTtl(60);
      setEnableCache(false);
      setCacheMaxAge(60);
      setCacheScope("public");
      setCacheSharedMaxAge("");
    }
    setError(null);
  }, [open, endpoint]);

  function handlePathChange(raw: string) {
    setPath(raw);
    if (!endpoint) {
      // Auto-suggest camelCase name from path segments if name wasn't manually typed
      const clean = raw.replace(/^\/+/, "").replace(/[:/.-]/g, " ").trim();
      if (clean) {
        setName(toCamelCase(clean));
      }
    }
  }

  function toggleRole(roleKey: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey],
    );
  }

  function handleSubmit() {
    const trimmedPath = path.trim();
    const trimmedName = name.trim();

    if (!trimmedPath) {
      setError("Path cannot be empty.");
      return;
    }
    if (!trimmedPath.startsWith("/") && !trimmedPath.startsWith(":")) {
      setError('Path should start with "/" (e.g. /publish or /stats) or a param (e.g. :id/archive).');
      return;
    }
    if (!trimmedName) {
      setError("Handler name cannot be empty.");
      return;
    }
    if (!/^[a-z][A-Za-z0-9]*$/.test(trimmedName)) {
      setError("Handler name must be camelCase (e.g. publishArticle).");
      return;
    }
    if (accessLevel === "roles" && selectedRoles.length === 0) {
      setError("Select at least one role when access level is set to Roles.");
      return;
    }

    // Check collision with other custom endpoints on this entity
    const siblings = (entity.customEndpoints ?? []).filter((ep) => ep.id !== endpoint?.id);
    const normalizedPath = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
    const collision = siblings.find(
      (ep) => ep.method === method && ep.path === normalizedPath,
    );
    if (collision) {
      setError(`Another custom endpoint already uses ${method} ${normalizedPath}.`);
      return;
    }
    const nameCollision = siblings.find((ep) => ep.name === trimmedName);
    if (nameCollision) {
      setError(`Another custom endpoint already uses handler name "${trimmedName}".`);
      return;
    }

    const throttleOverride =
      throttleMode === "custom"
        ? { limit: Math.max(1, throttleLimit), ttl: Math.max(1, throttleTtl) }
        : undefined;
    const skipThrottle = throttleMode === "skip" ? true : undefined;

    const parsedSharedMaxAge = cacheSharedMaxAge ? Number.parseInt(cacheSharedMaxAge, 10) : undefined;
    const cacheHint =
      method === "GET" && enableCache
        ? {
            maxAge: Math.max(0, cacheMaxAge),
            scope: cacheScope,
            sharedMaxAge:
              parsedSharedMaxAge !== undefined && !Number.isNaN(parsedSharedMaxAge)
                ? Math.max(0, parsedSharedMaxAge)
                : undefined,
          }
        : undefined;

    if (endpoint) {
      updateCustomEndpoint(entity.id, endpoint.id, {
        method,
        path: normalizedPath,
        name: trimmedName,
        description: description.trim() || undefined,
        access: {
          level: accessLevel,
          roles: accessLevel === "roles" ? selectedRoles : undefined,
        },
        throttle: throttleOverride,
        skipThrottle,
        cache: cacheHint,
      });
      pushToast({
        kind: "success",
        title: "Endpoint updated",
        message: `${method} ${normalizedPath} updated successfully.`,
      });
    } else {
      const created = createCustomEndpoint(
        trimmedName,
        method,
        normalizedPath,
        {
          level: accessLevel,
          roles: accessLevel === "roles" ? selectedRoles : undefined,
        },
      );
      if (description.trim()) {
        created.description = description.trim();
      }
      if (throttleOverride) {
        created.throttle = throttleOverride;
      }
      if (skipThrottle) {
        created.skipThrottle = true;
      }
      if (cacheHint) {
        created.cache = cacheHint;
      }
      addCustomEndpoint(entity.id, created);
      pushToast({
        kind: "success",
        title: "Endpoint added",
        message: `${method} ${normalizedPath} added to ${entity.name}.`,
      });
    }

    onOpenChange(false);
  }

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
          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
              {error}
            </div>
          ) : null}

          <EndpointRouteFields
            method={method}
            onMethodChange={setMethod}
            path={path}
            onPathChange={handlePathChange}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
          />

          <EndpointAccessSection
            accessLevel={accessLevel}
            onAccessLevelChange={setAccessLevel}
            roles={project.auth.roles}
            selectedRoles={selectedRoles}
            onToggleRole={toggleRole}
            hasOwnerOption={Boolean(entity.options.owner)}
            entityName={entity.name}
          />

          <EndpointThrottleSection
            throttleMode={throttleMode}
            onThrottleModeChange={setThrottleMode}
            throttleLimit={throttleLimit}
            onThrottleLimitChange={setThrottleLimit}
            throttleTtl={throttleTtl}
            onThrottleTtlChange={setThrottleTtl}
          />

          {method === "GET" ? (
            <EndpointCacheSection
              enableCache={enableCache}
              onEnableCacheChange={setEnableCache}
              cacheMaxAge={cacheMaxAge}
              onCacheMaxAgeChange={setCacheMaxAge}
              cacheScope={cacheScope}
              onCacheScopeChange={setCacheScope}
              cacheSharedMaxAge={cacheSharedMaxAge}
              onCacheSharedMaxAgeChange={setCacheSharedMaxAge}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {endpoint ? "Save changes" : "Add endpoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

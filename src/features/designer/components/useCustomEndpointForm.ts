import { useEffect, useState } from "react";
import { createCustomEndpoint } from "@/core/model/defaults";
import { toCamelCase } from "@/core/model/naming";
import type {
  AccessLevel,
  CustomEndpointDef,
  EntityDef,
  HttpMethod,
} from "@/core/model/schema";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import type { CacheScope } from "./EndpointCacheSection";
import type { ThrottleMode } from "./EndpointThrottleSection";

export function useCustomEndpointForm(
  entity: EntityDef,
  endpoint: CustomEndpointDef | null,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
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

  return {
    method,
    setMethod,
    path,
    handlePathChange,
    name,
    setName,
    description,
    setDescription,
    accessLevel,
    setAccessLevel,
    selectedRoles,
    toggleRole,
    throttleMode,
    setThrottleMode,
    throttleLimit,
    setThrottleLimit,
    throttleTtl,
    setThrottleTtl,
    enableCache,
    setEnableCache,
    cacheMaxAge,
    setCacheMaxAge,
    cacheScope,
    setCacheScope,
    cacheSharedMaxAge,
    setCacheSharedMaxAge,
    error,
    handleSubmit,
  };
}

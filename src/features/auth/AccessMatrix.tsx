import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_ROLE, USER_ENTITY_ID, isSystemEntity } from "@/core/model/defaults";
import {
  OPERATIONS,
  type AccessLevel,
  type AccessRule,
  type Operation,
} from "@/core/model/schema";
import { cn } from "@/lib/cn";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { AccessEntityTabs } from "./components/AccessEntityTabs";
import { AccessOperationRow } from "./components/AccessOperationRow";
import { AccessRestoreRow } from "./components/AccessRestoreRow";
import { OwnerRelationDialog } from "./components/OwnerRelationDialog";

export function AccessMatrix() {
  const project = useProjectStore((state) => state.project);
  const setAccess = useProjectStore((state) => state.setAccess);
  const selectedEntityId = useUiStore((state) => state.selectedEntityId);
  const selectEntity = useUiStore((state) => state.selectEntity);
  const pushToast = useUiStore((state) => state.pushToast);

  const [ownerPrompt, setOwnerPrompt] = useState<Operation | null>(null);

  useEffect(() => {
    if (!project) return;
    const custom = project.entities.filter((entity) => !isSystemEntity(entity));
    if (!custom.some((entity) => entity.id === selectedEntityId)) {
      selectEntity(custom[0]?.id ?? null);
    }
  }, [project, selectedEntityId, selectEntity]);

  if (!project) return null;

  const auth = project.auth;
  const entities = project.entities.filter((entity) => !isSystemEntity(entity));
  const entity = entities.find((candidate) => candidate.id === selectedEntityId) ?? null;

  function changeLevel(operation: Operation, level: AccessLevel, rule: AccessRule) {
    if (!entity) return;

    if (level === "owner" && !entity.options.owner) {
      if (!project?.entities.some((candidate) => candidate.id === USER_ENTITY_ID)) {
        pushToast({
          kind: "error",
          title: "The built-in User entity is missing",
          message: "Ownership needs a relation to User. Restore the project or recreate it.",
        });
        return;
      }
      setOwnerPrompt(operation);
      return;
    }

    if (level === "roles") {
      const fallback =
        auth.roles.find((role) => role.key === DEFAULT_ROLE)?.key ?? auth.roles[0]?.key;
      if (!fallback) {
        pushToast({
          kind: "error",
          title: "Add a role first",
          message: "Role-level access needs at least one defined role.",
        });
        return;
      }
      setAccess(entity.id, operation, {
        level: "roles",
        roles: rule.roles?.length ? rule.roles : [fallback],
      });
      return;
    }

    setAccess(entity.id, operation, { level });
  }

  function toggleRole(
    operation: Operation,
    rule: AccessRule,
    roleKey: string,
    checked: boolean,
  ) {
    if (!entity || rule.level !== "roles") return;

    const current = rule.roles ?? [];
    const next = checked
      ? [...current, roleKey]
      : current.filter((key) => key !== roleKey);

    if (next.length === 0) {
      pushToast({
        kind: "warning",
        title: "Keep at least one role",
        message: "Switch the level to authenticated or public instead of leaving roles empty.",
      });
      return;
    }

    setAccess(entity.id, operation, { level: "roles", roles: next });
  }

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">Access matrix</h2>
        <p className="mt-0.5 text-xs text-muted">
          One rule per CRUD operation. Owner rules add a managed relation to the built-in User.
        </p>
      </header>

      {entities.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted">
          Create an entity to configure access rules.
        </div>
      ) : (
        <>
          <AccessEntityTabs
            entities={entities}
            selectedEntityId={selectedEntityId}
            onSelectEntity={selectEntity}
          />

          {entity ? (
            <fieldset
              disabled={!auth.enabled}
              className={cn("min-w-0", !auth.enabled && "opacity-50")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {entity.name}
                  {entity.options.owner ? (
                    <Badge variant="accent">
                      owner → {entity.options.ownerRelation ?? "owner"}
                    </Badge>
                  ) : (
                    <Badge>ownership off</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  The built-in User routes are admin-only and not listed here.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted">
                      <th className="w-28 py-2.5 pl-5 font-medium">Operation</th>
                      <th className="w-48 py-2.5 font-medium">Access level</th>
                      <th className="py-2.5 pr-5 font-medium">Allowed roles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OPERATIONS.map((operation) => (
                      <AccessOperationRow
                        key={operation}
                        entityName={entity.name}
                        entityHasOwner={Boolean(entity.options.owner)}
                        operation={operation}
                        rule={entity.access[operation]}
                        roles={auth.roles}
                        onChangeLevel={changeLevel}
                        onToggleRole={toggleRole}
                      />
                    ))}
                    {entity.options.softDelete ? (
                      <AccessRestoreRow
                        deleteRule={entity.access.delete}
                        roles={auth.roles}
                      />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </fieldset>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted">
              Select an entity to configure its access rules.
            </div>
          )}
        </>
      )}

      <OwnerRelationDialog
        open={ownerPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setOwnerPrompt(null);
        }}
        entity={entity}
        ownerPrompt={ownerPrompt}
        onConfirm={(operation) => {
          if (entity) {
            setAccess(entity.id, operation, { level: "owner" });
          }
        }}
      />
    </section>
  );
}

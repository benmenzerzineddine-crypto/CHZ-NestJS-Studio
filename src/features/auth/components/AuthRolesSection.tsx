import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BufferedInput } from "@/components/ui/buffered-input";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { ADMIN_ROLE } from "@/core/model/defaults";
import type { AuthRole, Project } from "@/core/model/schema";
import { OPERATIONS } from "@/core/model/schema";
import { cn } from "@/lib/cn";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { AddRoleDialog } from "../AddRoleDialog";

export interface AuthRolesSectionProps {
  roles: AuthRole[];
  project: Project;
  locked: boolean;
}

function toRoleKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

export function AuthRolesSection({ roles, project, locked }: AuthRolesSectionProps) {
  const renameRole = useProjectStore((state) => state.renameRole);
  const updateRoleLabel = useProjectStore((state) => state.updateRoleLabel);
  const removeRole = useProjectStore((state) => state.removeRole);
  const pushToast = useUiStore((state) => state.pushToast);

  const [addRoleOpen, setAddRoleOpen] = useState(false);

  function roleUsage(key: string): number {
    return project.entities.reduce(
      (count, entity) =>
        count +
        OPERATIONS.filter((operation) => entity.access[operation].roles?.includes(key)).length,
      0,
    );
  }

  return (
    <CardSection
      title="Roles"
      description="Role keys are emitted as constants; labels are studio-only."
      divide={false}
      action={
        <Button
          variant="secondary"
          size="sm"
          disabled={locked}
          onClick={() => setAddRoleOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add role
        </Button>
      }
    >
      <fieldset
        disabled={locked}
        className={cn(locked && "opacity-50")}
      >
        <div className="divide-y divide-border">
          {roles.map((role) => {
            const isAdmin = role.key === ADMIN_ROLE;
            const usage = roleUsage(role.key);

            return (
              <div
                key={role.key}
                className="grid gap-3 px-5 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center"
              >
                <BufferedInput
                  aria-label={`${role.label} role key`}
                  value={role.key}
                  disabled={isAdmin}
                  className="h-8 font-mono text-xs"
                  transform={toRoleKey}
                  getError={(value) => {
                    if (!/^[a-z][a-z0-9_-]*$/.test(value)) {
                      return "Start with a lowercase letter; use letters, digits, - or _.";
                    }
                    if (
                      roles.some(
                        (candidate) => candidate.key !== role.key && candidate.key === value,
                      )
                    ) {
                      return "Role keys must be unique.";
                    }
                    return null;
                  }}
                  onCommit={(value) => {
                    if (!renameRole(role.key, value)) {
                      pushToast({
                        kind: "error",
                        title: "Role could not be renamed",
                        message: "Use a unique lowercase key. The admin key is locked.",
                      });
                    }
                  }}
                />
                <BufferedInput
                  aria-label={`${role.key} role label`}
                  value={role.label}
                  className="h-8 text-xs"
                  maxLength={40}
                  transform={(value) => value.trim()}
                  getError={(value) =>
                    value.length === 0 ? "A label is required." : null
                  }
                  onCommit={(value) => updateRoleLabel(role.key, value)}
                />
                <div className="flex items-center justify-end gap-2">
                  {isAdmin ? <Badge variant="accent">required</Badge> : null}
                  <span className="text-[11px] text-muted">
                    {usage} {usage === 1 ? "rule" : "rules"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted hover:text-danger"
                    aria-label={`Remove ${role.label}`}
                    disabled={isAdmin || usage > 0}
                    title={
                      isAdmin
                        ? "The admin role is required for ownership bypass"
                        : usage > 0
                          ? `Used by ${usage} access rules`
                          : undefined
                    }
                    onClick={() => {
                      if (!removeRole(role.key)) {
                        pushToast({
                          kind: "warning",
                          title: "Role is in use",
                          message: "Reassign or remove the access rules that reference this role.",
                        });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
      <p className="border-t border-border px-5 py-3 text-[11px] text-muted">
        The admin key cannot be renamed or removed: ownership bypass and admin user endpoints
        depend on it. Renaming a role updates every access rule.
      </p>

      <AddRoleDialog open={addRoleOpen} onOpenChange={setAddRoleOpen} />
    </CardSection>
  );
}

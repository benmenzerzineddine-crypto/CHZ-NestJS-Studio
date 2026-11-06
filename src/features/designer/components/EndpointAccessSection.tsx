import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AccessLevel, AuthRole } from "@/core/model/schema";

export interface EndpointAccessSectionProps {
  accessLevel: AccessLevel;
  onAccessLevelChange: (level: AccessLevel) => void;
  roles: AuthRole[];
  selectedRoles: string[];
  onToggleRole: (roleKey: string) => void;
  hasOwnerOption: boolean;
  entityName: string;
}

export function EndpointAccessSection({
  accessLevel,
  onAccessLevelChange,
  roles,
  selectedRoles,
  onToggleRole,
  hasOwnerOption,
  entityName,
}: EndpointAccessSectionProps) {
  return (
    <>
      <div>
        <Label className="text-xs">Access Level</Label>
        <Select
          value={accessLevel}
          onChange={(e) => onAccessLevelChange(e.target.value as AccessLevel)}
          className="mt-1 w-full"
        >
          <option value="authenticated">Authenticated</option>
          <option value="public">Public</option>
          <option value="roles">Roles</option>
          <option value="owner">Owner</option>
        </Select>
      </div>

      {accessLevel === "roles" ? (
        <div className="rounded-lg border border-border bg-surface-raised/40 p-3">
          <Label className="mb-2 block text-xs">Required Roles</Label>
          <div className="space-y-2">
            {roles.map((role) => (
              <label key={role.key} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={selectedRoles.includes(role.key)}
                  onChange={() => onToggleRole(role.key)}
                />
                <span>{role.label}</span>
                <span className="font-mono text-muted">({role.key})</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {accessLevel === "owner" && !hasOwnerOption ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          Ownership is not enabled on {entityName}. You must enable ownership in Entity Options
          before this endpoint can resolve owner scoping.
        </div>
      ) : null}
    </>
  );
}

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import {
  ACCESS_LEVELS,
  type AccessLevel,
  type AccessRule,
  type AuthRole,
  type Operation,
} from "@/core/model/schema";
import { cn } from "@/lib/cn";
import { LEVEL_LABELS, OPERATION_LABELS } from "./access-constants";

export interface AccessOperationRowProps {
  entityName: string;
  entityHasOwner: boolean;
  operation: Operation;
  rule: AccessRule;
  roles: AuthRole[];
  onChangeLevel: (operation: Operation, level: AccessLevel, rule: AccessRule) => void;
  onToggleRole: (operation: Operation, rule: AccessRule, roleKey: string, checked: boolean) => void;
}

export function AccessOperationRow({
  entityName,
  entityHasOwner,
  operation,
  rule,
  roles,
  onChangeLevel,
  onToggleRole,
}: AccessOperationRowProps) {
  const unknownRoles = (rule.roles ?? []).filter(
    (key) => !roles.some((role) => role.key === key),
  );
  const publicWrite =
    rule.level === "public" && operation !== "list" && operation !== "read";
  const ownerMissing = rule.level === "owner" && !entityHasOwner;

  return (
    <tr className="border-t border-border">
      <td className="py-3 pl-5 text-sm text-foreground">
        {OPERATION_LABELS[operation]}
      </td>
      <td className="py-3 pr-3">
        <Select
          value={rule.level}
          aria-label={`${entityName} ${operation} access level`}
          className="w-44"
          onChange={(event) =>
            onChangeLevel(operation, event.target.value as AccessLevel, rule)
          }
        >
          {ACCESS_LEVELS.map((level) => (
            <option key={level} value={level}>
              {LEVEL_LABELS[level]}
            </option>
          ))}
        </Select>
        {publicWrite ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-warning">
            <AlertTriangle className="h-3 w-3" />
            Public write
          </p>
        ) : null}
        {ownerMissing ? (
          <p className="mt-1 text-[11px] text-danger">Owner relation missing</p>
        ) : null}
      </td>
      <td className="py-3 pr-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {roles.map((role) => {
            const checked = rule.roles?.includes(role.key) ?? false;
            const disabled = rule.level !== "roles";
            return (
              <label
                key={role.key}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  disabled ? "text-muted/60" : "text-foreground",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    onToggleRole(operation, rule, role.key, event.target.checked)
                  }
                />
                {role.label}
              </label>
            );
          })}
        </div>
        {rule.level === "roles" && (rule.roles?.length ?? 0) === 0 ? (
          <p className="mt-1 text-[11px] text-danger">Select at least one role.</p>
        ) : null}
        {unknownRoles.length > 0 ? (
          <p className="mt-1 text-[11px] text-danger">
            Unknown roles: {unknownRoles.join(", ")}. Rename or remove them in the
            role editor.
          </p>
        ) : null}
      </td>
    </tr>
  );
}

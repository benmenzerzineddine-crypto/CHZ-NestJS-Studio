import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { AccessRule, AuthRole } from "@/core/model/schema";
import { LEVEL_LABELS } from "./access-constants";

export interface AccessRestoreRowProps {
  deleteRule: AccessRule;
  roles: AuthRole[];
}

export function AccessRestoreRow({ deleteRule, roles }: AccessRestoreRowProps) {
  return (
    <tr className="border-t border-border bg-surface-raised/30">
      <td className="py-3 pl-5 text-sm text-foreground">Restore</td>
      <td className="py-3 pr-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
          {LEVEL_LABELS[deleteRule.level]}
          <Lock className="h-3 w-3" />
        </span>
        <p className="mt-1 text-[11px] text-muted">
          Read-only. The restore route follows the Delete rule.
        </p>
      </td>
      <td className="py-3 pr-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {roles.map((role) => (
            <label
              key={role.key}
              className="flex items-center gap-1.5 text-xs text-muted/60"
            >
              <Checkbox
                checked={deleteRule.roles?.includes(role.key) ?? false}
                disabled
                readOnly
              />
              {role.label}
            </label>
          ))}
        </div>
      </td>
    </tr>
  );
}

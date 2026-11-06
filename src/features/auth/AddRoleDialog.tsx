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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectStore } from "@/store/project.store";

interface AddRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toRoleKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

export function AddRoleDialog({ open, onOpenChange }: AddRoleDialogProps) {
  const project = useProjectStore((state) => state.project);
  const addRole = useProjectStore((state) => state.addRole);

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKey("");
      setLabel("");
      setError(null);
    }
  }, [open]);

  function submit() {
    if (!project) return;
    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();

    if (!/^[a-z][a-z0-9_-]*$/.test(trimmedKey)) {
      setError("Role key must start with a lowercase letter.");
      return;
    }
    if (project.auth.roles.some((role) => role.key === trimmedKey)) {
      setError(`Role "${trimmedKey}" already exists.`);
      return;
    }
    if (!trimmedLabel) {
      setError("Add a human-readable label.");
      return;
    }

    if (!addRole(trimmedKey, trimmedLabel)) {
      setError("Could not add the role.");
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add role</DialogTitle>
          <DialogDescription>
            The key is used in generated guards and access rules; the label is shown in the studio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-role-key">Key</Label>
            <Input
              id="new-role-key"
              value={key}
              autoFocus
              placeholder="editor"
              className="font-mono text-xs"
              onChange={(event) => {
                setKey(toRoleKey(event.target.value));
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role-label">Label</Label>
            <Input
              id="new-role-label"
              value={label}
              maxLength={40}
              placeholder="Editor"
              onChange={(event) => {
                setLabel(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!key.trim() || !label.trim()}>
            Add role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

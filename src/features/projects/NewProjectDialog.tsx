import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Driver } from "@/core/model/schema";
import { toPackageName } from "@/core/model/defaults";
import { DRIVER_OPTIONS } from "@/lib/drivers";
import { errorMessage } from "@/lib/tauri";

export interface NewProjectInput {
  name: string;
  driver: Driver;
  authEnabled: boolean;
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewProjectInput) => Promise<void>;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [packageEdited, setPackageEdited] = useState(false);
  const [driver, setDriver] = useState<Driver>("postgres");
  const [authEnabled, setAuthEnabled] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setPackageName("");
    setPackageEdited(false);
    setDriver("postgres");
    setAuthEnabled(true);
    setPending(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!packageEdited) setPackageName(toPackageName(name));
  }, [name, packageEdited]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setPending(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), driver, authEnabled });
      onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Design a data model and export a NestJS + TypeORM API.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Blog API"
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="package-name">Package name</Label>
              <Input
                id="package-name"
                value={packageName}
                onChange={(event) => {
                  setPackageEdited(true);
                  setPackageName(event.target.value);
                }}
                placeholder="blog-api"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver">Database</Label>
              <Select
                id="driver"
                value={driver}
                onChange={(event) => setDriver(event.target.value as Driver)}
              >
                {DRIVER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-6 rounded-lg border border-border bg-surface-raised p-3.5">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Authentication</p>
              <p className="text-xs text-muted">
                JWT access + refresh tokens with roles and ownership.
              </p>
            </div>
            <Switch
              checked={authEnabled}
              onCheckedChange={setAuthEnabled}
              aria-label="Enable authentication"
            />
          </div>

          {error ? <p className="text-xs text-danger">{error}</p> : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

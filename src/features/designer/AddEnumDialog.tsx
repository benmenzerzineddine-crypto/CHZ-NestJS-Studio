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
import { toPascalCase } from "@/core/model/naming";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

interface AddEnumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEnumDialog({ open, onOpenChange }: AddEnumDialogProps) {
  const project = useProjectStore((state) => state.project);
  const addEnum = useProjectStore((state) => state.addEnum);
  const selectEnum = useUiStore((state) => state.selectEnum);
  const setDesignerTab = useUiStore((state) => state.setDesignerTab);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  function submit() {
    if (!project) return;
    const trimmed = name.trim();

    if (!/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) {
      setError("Use PascalCase, for example PostStatus.");
      return;
    }
    if (project.enums.some((enumDef) => enumDef.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`An enum named "${trimmed}" already exists.`);
      return;
    }

    const id = addEnum(trimmed, ["VALUE"]);
    setDesignerTab("enums");
    selectEnum(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New enum</DialogTitle>
          <DialogDescription>
            Enums are shared across entities and emitted as TypeScript enums.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-enum-name">Enum name</Label>
          <Input
            id="new-enum-name"
            value={name}
            placeholder="PostStatus"
            autoFocus
            onChange={(event) => {
              setName(toPascalCase(event.target.value));
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create enum
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EntityDef, Operation } from "@/core/model/schema";

export interface OwnerRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EntityDef | null;
  ownerPrompt: Operation | null;
  onConfirm: (operation: Operation) => void;
}

export function OwnerRelationDialog({
  open,
  onOpenChange,
  entity,
  ownerPrompt,
  onConfirm,
}: OwnerRelationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable ownership on {entity?.name}?</DialogTitle>
          <DialogDescription>
            Owner-only rules record who created each row. The studio will add a nullable
            many-to-one relation named{" "}
            <span className="font-mono">{entity?.options.ownerRelation ?? "owner"}</span> to the
            built-in User and set it on this entity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (ownerPrompt) {
                onConfirm(ownerPrompt);
              }
              onOpenChange(false);
            }}
          >
            Add owner relation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

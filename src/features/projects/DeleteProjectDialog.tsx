import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectSummary } from "@/lib/projects";

interface DeleteProjectDialogProps {
  pendingDelete: ProjectSummary | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteProjectDialog({
  pendingDelete,
  onClose,
  onConfirm,
}: DeleteProjectDialogProps) {
  return (
    <Dialog
      open={pendingDelete !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            {pendingDelete
              ? `"${pendingDelete.name}" will be removed from this device. Generated code already exported is not affected.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()}>
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

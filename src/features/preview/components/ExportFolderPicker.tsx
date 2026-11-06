import { FolderOpen, FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExportFolderPickerProps {
  folder: string;
  loading: boolean;
  exporting: boolean;
  onChooseFolder: () => void;
}

export function ExportFolderPicker({
  folder,
  loading,
  exporting,
  onChooseFolder,
}: ExportFolderPickerProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2">
      <FolderOpen className="h-4 w-4 shrink-0 text-muted" />
      <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
        {folder || "No folder selected"}
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={loading || exporting}
        onClick={onChooseFolder}
      >
        <FolderSearch className="h-3.5 w-3.5" />
        {folder ? "Change" : "Choose"}
      </Button>
    </div>
  );
}

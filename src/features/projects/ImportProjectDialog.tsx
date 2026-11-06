import { FileUp, Loader2, Sparkles } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Driver, Project } from "@/core/model/schema";
import { DRIVER_OPTIONS } from "@/lib/drivers";
import { useImportProjectForm } from "./useImportProjectForm";
import { ImportPreviewCard } from "./ImportPreviewCard";

interface ImportProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (project: Project) => Promise<void>;
}

export function ImportProjectDialog({
  open,
  onOpenChange,
  onImport,
}: ImportProjectDialogProps) {
  const {
    content,
    setContent,
    name,
    setName,
    format,
    setFormat,
    driver,
    setDriver,
    pending,
    error,
    parsedPreview,
    handleFileUpload,
    handleImport,
  } = useImportProjectForm(open, onImport, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Import schema to project</DialogTitle>
              <DialogDescription>
                Reverse-engineer SQL DDL, TypeORM entity classes, or OpenAPI schemas into a NestJS project.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-project-name">Project name</Label>
              <Input
                id="import-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-detected"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-format">Format</Label>
              <Select
                id="import-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="h-8 text-xs"
              >
                <option value="auto">Auto-detect</option>
                <option value="sql">SQL DDL</option>
                <option value="typeorm">TypeORM Entity (.ts)</option>
                <option value="openapi">OpenAPI 3.x (JSON)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-driver">Database driver</Label>
              <Select
                id="import-driver"
                value={driver}
                onChange={(e) => setDriver(e.target.value as Driver)}
                className="h-8 text-xs"
              >
                {DRIVER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Schema Source Textarea & File Picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="schema-content">Schema definition or code</Label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-foreground">
                <FileUp className="h-3.5 w-3.5" />
                <span>Upload file</span>
                <input
                  type="file"
                  accept=".sql,.ts,.json"
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                />
              </label>
            </div>
            <Textarea
              id="schema-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={9}
              placeholder="Paste SQL DDL, TypeORM entity TypeScript code, or OpenAPI JSON..."
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Real-time Parse Feedback Preview */}
          <ImportPreviewCard preview={parsedPreview} />

          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={pending || !parsedPreview?.ok}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Import & Open Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

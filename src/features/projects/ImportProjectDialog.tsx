import { FileUp, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { detectFormat, importProject, type ImportFormat } from "@/core/import";
import type { Driver, EntityDef, Project } from "@/core/model/schema";
import { validateProject } from "@/core/validate/validate";
import { DRIVER_OPTIONS } from "@/lib/drivers";
import { errorMessage } from "@/lib/tauri";

interface ImportProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (project: Project) => Promise<void>;
}

const SAMPLE_SQL = `-- Paste your PostgreSQL, MySQL, or SQLite DDL here
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);`;

export function ImportProjectDialog({
  open,
  onOpenChange,
  onImport,
}: ImportProjectDialogProps) {
  const [content, setContent] = useState(SAMPLE_SQL);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<ImportFormat | "auto">("auto");
  const [driver, setDriver] = useState<Driver>("postgres");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContent(SAMPLE_SQL);
    setName("");
    setFormat("auto");
    setDriver("postgres");
    setPending(false);
    setError(null);
  }, [open]);

  // Real-time preview parse
  const parsedPreview = useMemo(() => {
    if (!content.trim()) return null;
    try {
      const detected = format === "auto" ? detectFormat(content) : format;
      const project = importProject({
        content,
        format: detected,
        projectName: name.trim() || undefined,
        driver,
      });
      const issues = validateProject(project);
      const errors = issues.filter((i) => i.severity === "error");
      return {
        ok: errors.length === 0,
        format: detected,
        project,
        errors,
      };
    } catch (err) {
      return {
        ok: false,
        format: format === "auto" ? detectFormat(content) : format,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [content, format, name, driver]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setContent(text);
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleImport() {
    if (!parsedPreview?.ok || !parsedPreview.project) return;

    setPending(true);
    setError(null);
    try {
      await onImport(parsedPreview.project);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

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
          {parsedPreview ? (
            <div
              className={`rounded-lg border p-3 text-xs ${
                parsedPreview.ok
                  ? "border-success/30 bg-success/5 text-foreground"
                  : "border-warning/30 bg-warning/5 text-warning"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="accent" className="uppercase text-[9px]">
                    {parsedPreview.format}
                  </Badge>
                  {parsedPreview.ok && parsedPreview.project ? (
                    <span className="font-medium">
                      Detected {parsedPreview.project.entities.length} entities and{" "}
                      {parsedPreview.project.enums.length} enums
                    </span>
                  ) : (
                    <span className="font-medium text-danger">Parsing incomplete</span>
                  )}
                </div>
                {parsedPreview.ok ? (
                  <Badge variant="success" className="text-[9px]">
                    Valid
                  </Badge>
                ) : null}
              </div>

              {parsedPreview.ok && parsedPreview.project ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parsedPreview.project.entities.map((ent: EntityDef) => (
                    <span
                      key={ent.id}
                      className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted font-mono"
                    >
                      {ent.name} ({ent.fields.length} cols, {ent.relations.length} rels)
                    </span>
                  ))}
                </div>
              ) : parsedPreview.error ? (
                <p className="mt-1 text-[11px] text-danger">{parsedPreview.error}</p>
              ) : null}
            </div>
          ) : null}

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

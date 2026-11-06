import { useState, useEffect, useMemo } from "react";
import { detectFormat, importProject, type ImportFormat } from "@/core/import";
import type { Driver, Project } from "@/core/model/schema";
import { validateProject } from "@/core/validate/validate";
import { errorMessage } from "@/lib/tauri";

export const SAMPLE_SQL = `-- Paste your PostgreSQL, MySQL, or SQLite DDL here
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

export function useImportProjectForm(
  open: boolean,
  onImport: (project: Project) => Promise<void>,
  onOpenChange: (open: boolean) => void,
) {
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

  return {
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
  };
}

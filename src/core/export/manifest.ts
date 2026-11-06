import { z } from "zod";
import type { Project } from "../model/schema";
import type { GeneratedFile } from "../ir/types";
import { GENERATOR_VERSION } from "../version";

export interface ProjectManifest {
  generator: "chz-nest";
  generatorVersion: string;
  projectId: string;
  modelHash: string;
  createdAt: string;
  files: Record<string, string>;
}

export const projectManifestSchema = z.object({
  generator: z.literal("chz-nest"),
  generatorVersion: z.string(),
  projectId: z.string(),
  modelHash: z.string(),
  createdAt: z.string(),
  files: z.record(z.string(), z.string()),
});

export function parseProjectManifest(value: unknown): ProjectManifest {
  return projectManifestSchema.parse(value);
}

export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createManifest(
  project: Project,
  files: GeneratedFile[],
  createdAt: Date = new Date(),
  hashOverrides: Record<string, string> = {},
  omittedPaths: Iterable<string> = [],
): Promise<{ manifest: ProjectManifest; content: string }> {
  const omitted = new Set(omittedPaths);
  const hashes: Record<string, string> = {};
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    if (omitted.has(file.path)) continue;
    hashes[file.path] = hashOverrides[file.path] ?? (await sha256(file.content));
  }

  const manifest: ProjectManifest = {
    generator: "chz-nest",
    generatorVersion: GENERATOR_VERSION,
    projectId: project.id,
    modelHash: await sha256(stableStringify(project)),
    createdAt: createdAt.toISOString(),
    files: hashes,
  };

  return { manifest, content: `${JSON.stringify(manifest, null, 2)}\n` };
}

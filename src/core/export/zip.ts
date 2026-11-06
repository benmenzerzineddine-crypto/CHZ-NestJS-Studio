import { strToU8, zipSync } from "fflate";
import type { Project } from "../model/schema";
import type { GeneratedFile } from "../ir/types";
import { createManifest } from "./manifest";

export interface ZipResult {
  zip: Uint8Array;
  fileName: string;
  manifest: string;
}

function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function createProjectZip(
  project: Project,
  files: GeneratedFile[],
  now: Date = new Date(),
): Promise<ZipResult> {
  const { content } = await createManifest(project, files, now);
  const entries: Record<string, Uint8Array> = {};

  for (const file of files) {
    entries[file.path] = strToU8(file.content);
  }
  entries["chz-nest.json"] = strToU8(content);

  return {
    zip: zipSync(entries, { level: 9 }),
    fileName: `${project.packageName}-${dateStamp(now)}.zip`,
    manifest: content,
  };
}

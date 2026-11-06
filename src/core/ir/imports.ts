interface Entry {
  defaults: Set<string>;
  named: Set<string>;
  types: Set<string>;
}

/**
 * Collects imports while an emitter builds a file. Rendering sorts sources and
 * names so generated files are deterministic and never contain unused imports.
 */
export class ImportRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly sideEffects = new Set<string>();

  private entry(source: string): Entry {
    let entry = this.entries.get(source);
    if (!entry) {
      entry = { defaults: new Set(), named: new Set(), types: new Set() };
      this.entries.set(source, entry);
    }
    return entry;
  }

  add(source: string, ...names: string[]): this {
    const entry = this.entry(source);
    for (const name of names) entry.named.add(name.replace(/^@/, ""));
    return this;
  }

  addDefault(source: string, name: string): this {
    this.entry(source).defaults.add(name);
    return this;
  }

  addSideEffect(source: string): this {
    this.sideEffects.add(source);
    return this;
  }

  addType(source: string, ...names: string[]): this {
    const entry = this.entry(source);
    for (const name of names) entry.types.add(name.replace(/^@/, ""));
    return this;
  }

  render(): string {
    const lines: string[] = [];
    for (const source of [...this.sideEffects].sort((a, b) => a.localeCompare(b))) {
      lines.push(`import "${source}";`);
    }
    const sources = [...this.entries.keys()].sort((a, b) => a.localeCompare(b));

    for (const source of sources) {
      const entry = this.entries.get(source);
      if (!entry) continue;

      const defaults = [...entry.defaults].sort((a, b) => a.localeCompare(b));
      if (defaults.length > 0) {
        lines.push(`import ${defaults.join(", ")} from "${source}";`);
      }

      const named = [...entry.named].sort((a, b) => a.localeCompare(b));
      if (named.length > 0) {
        lines.push(`import { ${named.join(", ")} } from "${source}";`);
      }

      const types = [...entry.types].sort((a, b) => a.localeCompare(b));
      if (types.length > 0) {
        lines.push(`import type { ${types.join(", ")} } from "${source}";`);
      }
    }

    return lines.length > 0 ? `${lines.join("\n")}\n\n` : "";
  }
}

export function moduleImport(fromFile: string, toFile: string): string {
  const from = fromFile.split("/");
  const to = toFile.split("/");
  from.pop();
  while (from.length > 0 && to.length > 0 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  const relative = [...from.map(() => ".."), ...to].join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

export function stripExtension(path: string): string {
  return path.replace(/\.(ts|tsx|js|json)$/, "");
}

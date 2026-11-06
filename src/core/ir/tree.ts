import type { FileTree, GeneratedFile } from "./types";

interface MutableNode {
  name: string;
  path: string;
  files: GeneratedFile[];
  children: Map<string, MutableNode>;
}

function node(name: string, path: string): MutableNode {
  return { name, path, files: [], children: new Map() };
}

export function buildFileTree(files: GeneratedFile[], rootName = ""): FileTree {
  const root = node(rootName, "");

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/");
    const fileName = parts.pop();
    if (!fileName) continue;

    let current = root;
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let child = current.children.get(part);
      if (!child) {
        child = node(part, currentPath);
        current.children.set(part, child);
      }
      current = child;
    }
    current.files.push(file);
  }

  const freeze = (current: MutableNode): FileTree => ({
    name: current.name,
    path: current.path,
    files: current.files,
    children: [...current.children.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(freeze),
  });

  return freeze(root);
}

export function flattenFileTree(tree: FileTree): GeneratedFile[] {
  return [...tree.files, ...tree.children.flatMap(flattenFileTree)];
}

export function treeFileCount(tree: FileTree): number {
  return tree.files.length + tree.children.reduce((sum, child) => sum + treeFileCount(child), 0);
}

export function treeByteSize(tree: FileTree): number {
  return (
    tree.files.reduce((sum, file) => sum + new TextEncoder().encode(file.content).length, 0) +
    tree.children.reduce((sum, child) => sum + treeByteSize(child), 0)
  );
}

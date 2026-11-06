import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileJson2,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";
import type { FileTree } from "@/core/ir/types";
import { cn } from "@/lib/cn";

export interface FileTreeViewProps {
  tree: FileTree;
  selectedPath?: string;
  getFileDiffStatus?: (path: string) => "added" | "modified" | "unchanged" | null;
  onSelect: (path: string) => void;
}

interface NodeProps {
  node: FileTree;
  depth: number;
  selectedPath?: string;
  getFileDiffStatus?: (path: string) => "added" | "modified" | "unchanged" | null;
  onSelect: (path: string) => void;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
}

function fileIcon(path: string) {
  if (/\.json$/.test(path)) return FileJson2;
  if (/\.(md|txt)$/.test(path) || /\.[a-z]+$/.test(path) === false) return FileText;
  return FileCode2;
}

function Node({
  node,
  depth,
  selectedPath,
  getFileDiffStatus,
  onSelect,
  collapsed,
  onToggle,
}: NodeProps) {
  const folders = [...node.children].sort((a, b) => a.name.localeCompare(b.name));
  const files = [...node.files].sort((a, b) =>
    (a.path.split("/").pop() ?? a.path).localeCompare(b.path.split("/").pop() ?? b.path),
  );
  const isCollapsed = collapsed.has(node.path);

  return (
    <div>
      {node.path ? (
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-muted hover:bg-surface-raised hover:text-foreground"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
          {isCollapsed ? (
            <Folder className="h-3.5 w-3.5 shrink-0 text-accent/80" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/80" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      ) : null}

      {!isCollapsed ? (
        <>
          {folders.map((folder) => (
            <Node
              key={folder.path}
              node={folder}
              depth={node.path ? depth + 1 : depth}
              selectedPath={selectedPath}
              getFileDiffStatus={getFileDiffStatus}
              onSelect={onSelect}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
          {files.map((file) => {
            const Icon = fileIcon(file.path);
            const name = file.path.split("/").pop() ?? file.path;
            const active = selectedPath === file.path;
            const diffStatus = getFileDiffStatus?.(file.path);
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => onSelect(file.path)}
                title={file.path}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs",
                  active
                    ? "bg-accent/10 text-foreground"
                    : "text-muted hover:bg-surface-raised hover:text-foreground",
                )}
                style={{ paddingLeft: `${(node.path ? depth + 1 : depth) * 12 + 6}px` }}
              >
                <Icon
                  className={cn("h-3.5 w-3.5 shrink-0", active ? "text-accent" : "text-muted")}
                />
                <span className="truncate">{name}</span>
                {diffStatus === "added" ? (
                  <span
                    className="ml-auto shrink-0 font-mono text-[10px] font-semibold text-success"
                    title="Added"
                  >
                    +
                  </span>
                ) : diffStatus === "modified" ? (
                  <span
                    className="ml-auto shrink-0 font-mono text-[10px] font-semibold text-warning"
                    title="Modified"
                  >
                    ~
                  </span>
                ) : null}
              </button>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

export function FileTreeView({
  tree,
  selectedPath,
  getFileDiffStatus,
  onSelect,
}: FileTreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="py-1" aria-label="Generated files">
      <Node
        node={tree}
        depth={0}
        selectedPath={selectedPath}
        getFileDiffStatus={getFileDiffStatus}
        onSelect={onSelect}
        collapsed={collapsed}
        onToggle={toggle}
      />
    </div>
  );
}

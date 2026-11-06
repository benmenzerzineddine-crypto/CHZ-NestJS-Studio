import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FieldDef } from "@/core/model/schema";
import { FlagCell, TYPE_LABELS } from "./FieldHelpers";

export interface FieldTableRowProps {
  field: FieldDef;
  index: number;
  totalCount: number;
  selected: boolean;
  locked: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDragStart: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onDrop: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onDragEnd: () => void;
}

export function FieldTableRow({
  field,
  index,
  totalCount,
  selected,
  locked,
  isDragging,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: FieldTableRowProps) {
  return (
    <tr
      draggable
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`cursor-pointer border-t border-border transition-colors ${
        selected ? "bg-accent/10" : "hover:bg-surface-raised/60"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <td className="py-2.5 pl-4 text-muted">
        <GripVertical className="h-3.5 w-3.5" />
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground">{field.name}</span>
          {field.primary ? <Badge variant="accent">PK</Badge> : null}
        </div>
      </td>
      <td className="py-2.5 pr-3">
        <Badge>{TYPE_LABELS[field.type]}</Badge>
      </td>
      <td className="py-2.5 text-center">
        <FlagCell value={field.required} />
      </td>
      <td className="py-2.5 text-center">
        <FlagCell value={field.unique} />
      </td>
      <td className="py-2.5 text-center">
        <FlagCell value={field.indexed} />
      </td>
      <td className="py-2.5 text-center">
        <FlagCell value={field.primary} />
      </td>
      <td className="py-2.5 pr-3">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Move ${field.name} up`}
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation();
              onMoveUp();
            }}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Move ${field.name} down`}
            disabled={index === totalCount - 1}
            onClick={(event) => {
              event.stopPropagation();
              onMoveDown();
            }}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted hover:text-danger"
            aria-label={`Delete ${field.name}`}
            disabled={locked}
            title={locked ? "The email column is required by authentication" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { HTTP_METHODS, type HttpMethod } from "@/core/model/schema";

export interface EndpointRouteFieldsProps {
  method: HttpMethod;
  onMethodChange: (method: HttpMethod) => void;
  path: string;
  onPathChange: (path: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
}

export function EndpointRouteFields({
  method,
  onMethodChange,
  path,
  onPathChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
}: EndpointRouteFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">HTTP Method</Label>
          <Select
            value={method}
            onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
            className="mt-1 w-full"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2">
          <Label className="text-xs">Route Path</Label>
          <Input
            className="mt-1 font-mono text-xs"
            placeholder="/publish or :id/archive"
            value={path}
            onChange={(e) => onPathChange(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Handler Name (camelCase)</Label>
        <Input
          className="mt-1 font-mono text-xs"
          placeholder="publish"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs">Description (optional)</Label>
        <Input
          className="mt-1 text-xs"
          placeholder="e.g. Publish an article"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
    </>
  );
}

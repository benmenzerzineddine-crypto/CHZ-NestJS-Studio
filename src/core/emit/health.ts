import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import { AUTH_PUBLIC_PATH, HEALTH_PATH, file } from "./helpers";
import type { ProjectIR } from "../ir/types";

export function emitHealth(ir: ProjectIR): import("../ir/types").GeneratedFile {
  const registry = new ImportRegistry();
  registry.add("@nestjs/common", "Controller", "Get");
  registry.add("@nestjs/swagger", "ApiTags");
  if (ir.auth.enabled) registry.add(sourceImport(HEALTH_PATH, AUTH_PUBLIC_PATH), "Public");

  const decorators = ir.auth.enabled ? "  @Public()\n" : "";
  const content = `${registry.render()}@ApiTags('health')
@Controller('health')
export class HealthController {
${decorators}  @Get()
  health(): { status: string } {
    return { status: 'ok' };
  }
}
`;
  return file(HEALTH_PATH, content);
}

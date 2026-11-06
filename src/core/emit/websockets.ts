import type { GeneratedFile, ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { file, sourceImport } from "./helpers";

export const EVENTS_GATEWAY_PATH = "src/events/events.gateway.ts";
export const EVENTS_MODULE_PATH = "src/events/events.module.ts";

export function emitWebSockets(ir: ProjectIR): GeneratedFile[] {
  if (!ir.websockets.enabled) {
    return [];
  }

  const files: GeneratedFile[] = [];

  // 1. Emit EventsGateway
  const gatewayRegistry = new ImportRegistry();
  gatewayRegistry.add(
    "@nestjs/websockets",
    "WebSocketGateway",
    "WebSocketServer",
    "OnGatewayConnection",
    "OnGatewayDisconnect",
  );
  gatewayRegistry.add("@nestjs/common", "Logger");
  gatewayRegistry.addType("socket.io", "Server", "Socket");

  if (ir.auth.enabled && ir.websockets.auth) {
    gatewayRegistry.add("@nestjs/jwt", "JwtService");
  }

  const corsOrigin = JSON.stringify(ir.websockets.corsOrigin || "*");
  const wsPath = JSON.stringify(ir.websockets.path || "/events");

  const gatewayLines: string[] = [];

  gatewayLines.push(`@WebSocketGateway({
  cors: { origin: ${corsOrigin} },
  path: ${wsPath},
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);`);

  if (ir.auth.enabled && ir.websockets.auth) {
    gatewayLines.push(`
  constructor(private readonly jwtService: JwtService) {}`);
  } else {
    gatewayLines.push(`
  constructor() {}`);
  }

  // Connection Handler
  gatewayLines.push(`
  async handleConnection(client: Socket) {
    try {
      this.logger.log(\`Client connected: \${client.id}\`);`);

  if (ir.auth.enabled && ir.websockets.auth) {
    gatewayLines.push(`      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace(/^Bearer\\s+/i, "") ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(\`Unauthorized connection attempt from \${client.id}\`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.data.user = payload;

      const userId = payload.sub || payload.id;
      if (userId) {
        client.join(\`user:\${userId}\`);
        this.logger.debug(\`Client \${client.id} joined room user:\${userId}\`);
      }`);

    if (ir.multitenancy.enabled) {
      gatewayLines.push(`
      const tenantId =
        payload.tenantId ||
        (client.handshake.headers?.["x-tenant-id"] as string) ||
        (client.handshake.query?.tenantId as string);

      if (tenantId) {
        client.join(\`tenant:\${tenantId}\`);
        this.logger.debug(\`Client \${client.id} joined room tenant:\${tenantId}\`);
      }`);
    }
  } else if (ir.multitenancy.enabled) {
    gatewayLines.push(`      const tenantId =
        (client.handshake.headers?.["x-tenant-id"] as string) ||
        (client.handshake.query?.tenantId as string);

      if (tenantId) {
        client.join(\`tenant:\${tenantId}\`);
        this.logger.debug(\`Client \${client.id} joined room tenant:\${tenantId}\`);
      }`);
  }

  gatewayLines.push(`    } catch (err) {
      this.logger.warn(\`Connection authentication error for \${client.id}: \${err}\`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(\`Client disconnected: \${client.id}\`);
  }

  broadcast(event: string, payload: any, room?: string) {
    if (room) {
      this.server.to(room).emit(event, payload);
    } else {
      this.server.emit(event, payload);
    }
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(\`user:\${userId}\`).emit(event, payload);
  }

  emitToTenant(tenantId: string, event: string, payload: any) {
    this.server.to(\`tenant:\${tenantId}\`).emit(event, payload);
  }

  emitEntityEvent(
    entity: string,
    action: "created" | "updated" | "deleted",
    data: any,
    tenantId?: string,
  ) {
    const event = \`\${entity.toLowerCase()}:\${action}\`;
    const payload = {
      entity,
      action,
      data,
      timestamp: new Date().toISOString(),
    };

    if (tenantId) {
      this.emitToTenant(tenantId, event, payload);
    } else {
      this.broadcast(event, payload);
    }
  }
}`);

  const gatewayContent = `${gatewayRegistry.render()}${gatewayLines.join("\n")}\n`;
  files.push(file(EVENTS_GATEWAY_PATH, gatewayContent));

  // 2. Emit EventsModule
  const moduleRegistry = new ImportRegistry();
  moduleRegistry.add("@nestjs/common", "Global", "Module");
  moduleRegistry.add(
    sourceImport(EVENTS_MODULE_PATH, EVENTS_GATEWAY_PATH),
    "EventsGateway",
  );

  const imports: string[] = [];
  if (ir.auth.enabled && ir.websockets.auth) {
    moduleRegistry.add(
      sourceImport(EVENTS_MODULE_PATH, "src/auth/auth.module.ts"),
      "AuthModule",
    );
    imports.push("AuthModule");
  }

  const moduleContent = `${moduleRegistry.render()}@Global()
@Module({
  imports: [${imports.join(", ")}],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
`;

  files.push(file(EVENTS_MODULE_PATH, moduleContent));

  return files;
}

# Milestone M5p — Real-Time WebSockets & Event Broadcasting

Desktop studio and code generator support for real-time WebSocket communication in NestJS using `@nestjs/websockets` and Socket.IO.

- **Status:** done
- **Depends on:** [`21-background-jobs-bullmq.md`](21-background-jobs-bullmq.md) (M5o)

---

## 1. Goal

Provide seamless real-time WebSocket capabilities for generated NestJS APIs. When enabled:
1. `@nestjs/websockets`, `@nestjs/platform-socket.io`, and `socket.io` dependencies are added to `package.json`.
2. `@Global()` `EventsModule` and `EventsGateway` are generated with configurable namespace/path and CORS origins.
3. Socket authentication hooks validate JWT handshake queries/headers against `JwtService`.
4. Tenant and user room scoping helpers allow targeted messaging (`client.join('tenant:...')`, `client.join('user:...')`).
5. When `broadcastCrud` is enabled, entity services dispatch lifecycle events (`entity:created`, `entity:updated`, `entity:deleted`) across the gateway.
6. Studio UI section in Settings enables developers to toggle and configure real-time settings.

---

## 2. Model & Validation

### 2.1 Settings Schema (`src/core/model/schema.ts`)

```typescript
export interface WebSocketConfig {
  enabled: boolean;
  adapter: "socket.io";
  path: string; // default: "/events"
  corsOrigin: string; // default: "*"
  auth: boolean; // default: true (validate JWT on connection)
  broadcastCrud: boolean; // default: true
}
```

### 2.2 Validation Rules (`src/core/validate/check-websockets.ts`)
- `path` must start with `/` and contain only valid URL path characters (`/^\/[a-zA-Z0-9/_-]*$/`).
- `corsOrigin` cannot be empty.

---

## 3. Emitted Code Structure

When `project.settings.websockets.enabled` is `true`:

```
src/
  events/
    events.gateway.ts
    events.module.ts
```

### `events.gateway.ts`
```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  path: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) { ... }
  handleDisconnect(client: Socket) { ... }

  broadcast(event: string, payload: any, room?: string) {
    if (room) {
      this.server.to(room).emit(event, payload);
    } else {
      this.server.emit(event, payload);
    }
  }

  emitEntityEvent(entity: string, action: 'created' | 'updated' | 'deleted', data: any, tenantId?: string) {
    const event = `${entity}:${action}`;
    const room = tenantId ? `tenant:${tenantId}` : undefined;
    this.broadcast(event, { entity, action, data, timestamp: new Date().toISOString() }, room);
  }
}
```

---

## 4. Tasks

1. **Schema & Defaults**:
   - Add `WebSocketConfig` and schema to `src/core/model/schema.ts`.
   - Add `defaultWebSockets()` to `src/core/model/defaults.ts`.
2. **Validation**:
   - Implement `checkWebSockets()` and integrate into `validateProject()`.
3. **Emitters**:
   - Implement `src/core/emit/websockets.ts` emitting `EventsGateway` and `EventsModule`.
   - Update `src/core/emit/service.ts` to optionally inject and invoke `EventsGateway` on `create`, `update`, `remove`.
   - Update `src/core/emit/scaffold.ts` for Socket.IO dependencies.
   - Update `src/core/emit/config.ts` (`AppModule`) to import `EventsModule`.
4. **Studio UI**:
   - Implement `WebSocketsSettingsSection.tsx` and integrate into `SettingsScreen.tsx`.
5. **Testing**:
   - Unit tests for schema, validation, emitters, and settings UI.
   - Full test suite passing + production build verification.

# Milestone M5o — Background Jobs & Worker Queues (BullMQ / Redis)

Desktop studio and generator support for background job queues powered by BullMQ and Redis in NestJS.

- **Status:** done
- **Depends on:** [`20-schema-and-db-import.md`](20-schema-and-db-import.md) (M5n)

---

## 1. Goal

Allow developers to configure asynchronous background worker queues directly within `chz-nest`. When enabled, the generator produces:
1. Redis service in `docker-compose.yml` and environment variables in `.env.example`.
2. `@nestjs/bullmq` and `bullmq` dependencies in `package.json`.
3. `JobsModule` configured with `BullModule.forRootAsync` and registered queues.
4. Strongly typed **Producers** (`<queue>.service.ts` or `<queue>.producer.ts`) with helper methods to enqueue jobs with delay, attempts, and backoff settings.
5. Typed **Processors** (`<queue>.processor.ts` extending `WorkerHost` or `@Processor`) handling job executions with stubbed handlers.
6. Studio UI tab to configure queues, jobs, concurrency, retries, and backoff strategies.

---

## 2. Model & Schema Specification

### 2.1 Settings Schema (`src/core/model/schema.ts`)

```typescript
export interface QueueJobDef {
  id: string; // "job_..."
  name: string; // e.g. "sendWelcomeEmail", "generatePdfReport"
  description?: string;
  attempts?: number; // default: 3
  backoffDelayMs?: number; // default: 1000
  backoffType?: "fixed" | "exponential"; // default: "exponential"
}

export interface QueueDef {
  id: string; // "que_..."
  name: string; // e.g. "mail", "reports", "webhooks"
  description?: string;
  concurrency?: number; // default: 1
  jobs: QueueJobDef[];
}

export interface QueuesConfig {
  enabled: boolean;
  redisHost: string; // default: "localhost"
  redisPort: number; // default: 6379
  redisPassword?: string;
  queues: QueueDef[];
}
```

### 2.2 Invariants & Validation Rules (`src/core/validate/check-queues.ts`)
- Queue names must be kebab-case or camelCase (`/^[a-z][a-z0-9-]*$/`).
- Queue names must be unique within the project.
- Job names must be camelCase identifiers (`/^[a-z][a-zA-Z0-9]*$/`).
- Job names must be unique within their owning queue.
- `attempts` must be an integer >= 1.
- `backoffDelayMs` must be >= 0.
- `concurrency` must be an integer >= 1.
- `redisPort` must be between 1 and 65535.

---

## 3. Emitted Code Structure

When `project.settings.queues.enabled` is `true`:

```
src/
  jobs/
    jobs.module.ts
    <queue-name>/
      <queue-name>.producer.ts
      <queue-name>.processor.ts
```

### `jobs.module.ts`
Registers `BullModule.forRootAsync` reading `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` from `ConfigService`, and calls `BullModule.registerQueue(...)` for each defined queue.

### `<queue-name>.producer.ts`
Injectable service injecting `@InjectQueue('<queue-name>') private queue: Queue`:
```typescript
@Injectable()
export class MailProducer {
  constructor(@InjectQueue('mail') private readonly queue: Queue) {}

  async sendWelcomeEmail(data: Record<string, any>, opts?: JobsOptions) {
    return this.queue.add('sendWelcomeEmail', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      ...opts,
    });
  }
}
```

### `<queue-name>.processor.ts`
Worker host processing jobs:
```typescript
@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'sendWelcomeEmail':
        this.logger.log(`Processing job ${job.name} (ID: ${job.id})`);
        // TODO: Implement sendWelcomeEmail job logic
        return { success: true };
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        break;
    }
  }
}
```

---

## 4. Tasks

1. **Schema & Defaults**:
   - Add `QueueJobDef`, `QueueDef`, `QueuesConfig` to `schema.ts`.
   - Add `defaultQueues()` factory and default settings to `defaults.ts`.
2. **Validation**:
   - Implement `checkQueues()` and wire into `validateProject()`.
3. **Emitters**:
   - Implement `src/core/emit/jobs.ts` emitting `jobs.module.ts`, producers, and processors.
   - Update `src/core/emit/docker.ts` to include `redis:7-alpine` service with health checks when enabled.
   - Update `src/core/emit/env.ts` with `REDIS_HOST`, `REDIS_PORT`.
   - Update `src/core/emit/package-json.ts` with `@nestjs/bullmq` and `bullmq`.
   - Update `src/core/emit/app-module.ts` to conditionally import `JobsModule`.
4. **Studio UI**:
   - Create `QueuesScreen` / Tab under Settings or Navigation to edit queues and jobs.
5. **Testing**:
   - Unit tests for validation, emitters, and UI components.
   - Full golden test and build verification.

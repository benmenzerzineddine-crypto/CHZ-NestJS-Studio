import type { GeneratedFile, ProjectIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { toPascalCase } from "../model/naming";
import { file, sourceImport } from "./helpers";

export function emitJobs(ir: ProjectIR): GeneratedFile[] {
  if (!ir.queues.enabled) {
    return [];
  }

  const files: GeneratedFile[] = [];
  const queueModules: {
    queueName: string;
    producerClass: string;
    processorClass: string;
    producerPath: string;
    processorPath: string;
  }[] = [];

  for (const queue of ir.queues.queues) {
    const queuePascal = toPascalCase(queue.name);
    const producerClass = `${queuePascal}Producer`;
    const processorClass = `${queuePascal}Processor`;
    const producerPath = `src/jobs/${queue.name}/${queue.name}.producer.ts`;
    const processorPath = `src/jobs/${queue.name}/${queue.name}.processor.ts`;

    queueModules.push({
      queueName: queue.name,
      producerClass,
      processorClass,
      producerPath,
      processorPath,
    });

    // 1. Emit Producer
    const producerRegistry = new ImportRegistry();
    producerRegistry.add("@nestjs/common", "Injectable");
    producerRegistry.add("@nestjs/bullmq", "InjectQueue");
    producerRegistry.addType("bullmq", "Queue", "JobsOptions");

    const jobMethods = queue.jobs.map((job) => {
      const attempts = job.attempts ?? 3;
      const backoffType = job.backoffType ?? "exponential";
      const backoffDelay = job.backoffDelayMs ?? 1000;

      return `  async ${job.name}(data: Record<string, any> = {}, opts?: JobsOptions) {
    return this.queue.add('${job.name}', data, {
      attempts: ${attempts},
      backoff: {
        type: '${backoffType}',
        delay: ${backoffDelay},
      },
      ...opts,
    });
  }`;
    });

    const producerContent = `${producerRegistry.render()}@Injectable()
export class ${producerClass} {
  constructor(@InjectQueue('${queue.name}') private readonly queue: Queue) {}

${jobMethods.join("\n\n")}
}
`;
    files.push(file(producerPath, producerContent));

    // 2. Emit Processor
    const processorRegistry = new ImportRegistry();
    processorRegistry.add("@nestjs/common", "Logger");
    processorRegistry.add("@nestjs/bullmq", "Processor", "WorkerHost");
    processorRegistry.addType("bullmq", "Job");

    const processorOpts =
      queue.concurrency && queue.concurrency > 1 ? `, { concurrency: ${queue.concurrency} }` : "";

    const jobCases = queue.jobs.map((job) => {
      return `      case '${job.name}':
        this.logger.log(\`Processing job '\${job.name}' (ID: \${job.id})\`);
        // TODO: Implement ${job.name} job logic
        return { success: true };`;
    });

    const processorContent = `${processorRegistry.render()}@Processor('${queue.name}'${processorOpts})
export class ${processorClass} extends WorkerHost {
  private readonly logger = new Logger(${processorClass}.name);

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
${jobCases.join("\n")}
      default:
        this.logger.warn(\`Unknown job name: '\${job.name}' on queue '${queue.name}'\`);
        return { error: 'Unknown job' };
    }
  }
}
`;
    files.push(file(processorPath, processorContent));
  }

  // 3. Emit JobsModule
  const moduleRegistry = new ImportRegistry();
  moduleRegistry.add("@nestjs/common", "Global", "Module");
  moduleRegistry.add("@nestjs/config", "ConfigModule", "ConfigService");
  moduleRegistry.add("@nestjs/bullmq", "BullModule");

  const jobsModulePath = "src/jobs/jobs.module.ts";

  for (const q of queueModules) {
    moduleRegistry.add(sourceImport(jobsModulePath, q.producerPath), q.producerClass);
    moduleRegistry.add(sourceImport(jobsModulePath, q.processorPath), q.processorClass);
  }

  const queueRegistrations = queueModules.map(
    (q) => `    BullModule.registerQueue({ name: '${q.queueName}' }),`,
  );

  const producers = queueModules.map((q) => `    ${q.producerClass},`);
  const processors = queueModules.map((q) => `    ${q.processorClass},`);

  const jobsModuleContent = `${moduleRegistry.render()}@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', ${JSON.stringify(ir.queues.redisHost || "localhost")}),
          port: Number(config.get<string | number>('REDIS_PORT', ${ir.queues.redisPort || 6379})),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
${queueRegistrations.join("\n")}
  ],
  providers: [
${producers.join("\n")}
${processors.join("\n")}
  ],
  exports: [
    BullModule,
${producers.join("\n")}
  ],
})
export class JobsModule {}
`;

  files.push(file(jobsModulePath, jobsModuleContent));

  return files;
}

import { describe, expect, it } from "vitest";
import { generateProject } from "../generate";
import { createProject, createQueue, createQueueJob } from "../model/defaults";
import { emitJobs } from "./jobs";
import { buildIR } from "../ir/build";

describe("emitJobs", () => {
  it("returns empty array when queues are disabled", () => {
    const project = createProject("No Queues API");
    project.settings.queues.enabled = false;
    const ir = buildIR(project);
    expect(emitJobs(ir)).toEqual([]);
  });

  it("emits JobsModule, producer, and processor files with correct configuration", () => {
    const project = createProject("Queue API");
    project.settings.queues.enabled = true;
    project.settings.queues.redisHost = "redis.internal";
    project.settings.queues.redisPort = 6380;
    project.settings.queues.queues = [
      createQueue("mail", [
        createQueueJob("sendWelcomeEmail", { attempts: 5, backoffDelayMs: 2000, backoffType: "fixed" }),
        createQueueJob("sendPasswordReset"),
      ]),
      createQueue("reports", [
        createQueueJob("generatePdf"),
      ], { concurrency: 4 }),
    ];

    const ir = buildIR(project);
    const files = emitJobs(ir);

    expect(files.length).toBe(5); // jobs.module.ts + 2 producers + 2 processors

    const paths = files.map((f) => f.path);
    expect(paths).toContain("src/jobs/jobs.module.ts");
    expect(paths).toContain("src/jobs/mail/mail.producer.ts");
    expect(paths).toContain("src/jobs/mail/mail.processor.ts");
    expect(paths).toContain("src/jobs/reports/reports.producer.ts");
    expect(paths).toContain("src/jobs/reports/reports.processor.ts");

    // Check JobsModule
    const jobsModule = files.find((f) => f.path === "src/jobs/jobs.module.ts")!;
    expect(jobsModule.content).toContain("BullModule.forRootAsync");
    expect(jobsModule.content).toContain("BullModule.registerQueue({ name: 'mail' })");
    expect(jobsModule.content).toContain("BullModule.registerQueue({ name: 'reports' })");
    expect(jobsModule.content).toContain("MailProducer");
    expect(jobsModule.content).toContain("MailProcessor");
    expect(jobsModule.content).toContain("ReportsProducer");
    expect(jobsModule.content).toContain("ReportsProcessor");

    // Check Producer
    const mailProducer = files.find((f) => f.path === "src/jobs/mail/mail.producer.ts")!;
    expect(mailProducer.content).toContain("@InjectQueue('mail')");
    expect(mailProducer.content).toContain("async sendWelcomeEmail(data: Record<string, any> = {}, opts?: JobsOptions)");
    expect(mailProducer.content).toContain("attempts: 5");
    expect(mailProducer.content).toContain("delay: 2000");
    expect(mailProducer.content).toContain("type: 'fixed'");
    expect(mailProducer.content).toContain("async sendPasswordReset(");

    // Check Processor
    const reportsProcessor = files.find((f) => f.path === "src/jobs/reports/reports.processor.ts")!;
    expect(reportsProcessor.content).toContain("@Processor('reports', { concurrency: 4 })");
    expect(reportsProcessor.content).toContain("case 'generatePdf':");
  });

  it("integrates into generateProject, package.json, docker-compose, and app.module", async () => {
    const project = createProject("Queue API");
    project.settings.queues.enabled = true;
    project.settings.queues.queues = [
      createQueue("notifications", [createQueueJob("pushNotify")]),
    ];

    const result = await generateProject(project, { format: false });

    // package.json dependencies
    const packageJson = result.files.find((f) => f.path === "package.json")!;
    expect(packageJson.content).toContain("@nestjs/bullmq");
    expect(packageJson.content).toContain("bullmq");

    // app.module.ts import
    const appModule = result.files.find((f) => f.path === "src/app.module.ts")!;
    expect(appModule.content).toContain("JobsModule");

    // .env.example
    const envExample = result.files.find((f) => f.path === ".env.example")!;
    expect(envExample.content).toContain("REDIS_HOST=localhost");
    expect(envExample.content).toContain("REDIS_PORT=6379");

    // docker-compose.yml
    const dockerCompose = result.files.find((f) => f.path === "docker-compose.yml")!;
    expect(dockerCompose.content).toContain("redis:7-alpine");
    expect(dockerCompose.content).toContain("REDIS_HOST: redis");
  });
});

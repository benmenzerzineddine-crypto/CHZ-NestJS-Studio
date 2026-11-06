import { describe, expect, it } from "vitest";
import { createProject, createQueue, createQueueJob } from "../model/defaults";
import { validateProject } from "./validate";

describe("checkQueues validation", () => {
  it("passes validation when queues are disabled", () => {
    const project = createProject("Queue API");
    project.settings.queues.enabled = false;
    const issues = validateProject(project);
    expect(issues.filter((i) => i.code.startsWith("queue."))).toEqual([]);
  });

  it("validates redis host and port when queues enabled", () => {
    const project = createProject("Queue API");
    project.settings.queues.enabled = true;
    project.settings.queues.redisHost = "";
    project.settings.queues.redisPort = 99999;

    const issues = validateProject(project);
    expect(issues.some((i) => i.code === "queue.redisHost.empty")).toBe(true);
    expect(issues.some((i) => i.code === "queue.redisPort.invalid")).toBe(true);
  });

  it("validates queue naming and detects duplicate queues", () => {
    const project = createProject("Queue API");
    project.settings.queues.enabled = true;
    project.settings.queues.queues = [
      createQueue("Invalid Queue Name!"),
      createQueue("mail"),
      createQueue("mail"), // duplicate
    ];

    const issues = validateProject(project);
    expect(issues.some((i) => i.code === "queue.name.invalid")).toBe(true);
    expect(issues.some((i) => i.code === "queue.name.duplicate")).toBe(true);
  });

  it("validates job naming, duplicate jobs, and attempts/backoff bounds", () => {
    const project = createProject("Queue API");
    project.settings.queues.enabled = true;
    project.settings.queues.queues = [
      createQueue("notifications", [
        createQueueJob("validJob"),
        createQueueJob("validJob"), // duplicate in same queue
        createQueueJob("Invalid-Job-Name"), // not camelCase
        createQueueJob("badAttempts", { attempts: 0 }),
        createQueueJob("badBackoff", { backoffDelayMs: -100 }),
      ]),
    ];

    const issues = validateProject(project);
    expect(issues.some((i) => i.code === "queue.job.name.duplicate")).toBe(true);
    expect(issues.some((i) => i.code === "queue.job.name.invalid")).toBe(true);
    expect(issues.some((i) => i.code === "queue.job.attempts.invalid")).toBe(true);
    expect(issues.some((i) => i.code === "queue.job.backoffDelayMs.invalid")).toBe(true);
  });
});

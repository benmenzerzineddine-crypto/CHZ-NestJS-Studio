import type { Project } from "../model/schema";
import { issue, type ValidationIssue } from "./types";

const QUEUE_NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const JOB_NAME_REGEX = /^[a-z][a-zA-Z0-9]*$/;

export function checkQueues(project: Project, issues: ValidationIssue[]): void {
  const queuesConfig = project.settings.queues;
  if (!queuesConfig || !queuesConfig.enabled) {
    return;
  }

  if (!queuesConfig.redisHost || !queuesConfig.redisHost.trim()) {
    issues.push(
      issue({
        code: "queue.redisHost.empty",
        message: "Redis host cannot be empty when background queues are enabled.",
      }),
    );
  }

  if (
    typeof queuesConfig.redisPort !== "number" ||
    queuesConfig.redisPort < 1 ||
    queuesConfig.redisPort > 65535
  ) {
    issues.push(
      issue({
        code: "queue.redisPort.invalid",
        message: "Redis port must be a valid port number between 1 and 65535.",
      }),
    );
  }

  const seenQueueNames = new Set<string>();

  for (const queue of queuesConfig.queues) {
    const qName = queue.name.trim();

    if (!qName || !QUEUE_NAME_REGEX.test(qName)) {
      issues.push(
        issue({
          code: "queue.name.invalid",
          message: `Queue name "${queue.name}" is invalid. Use lowercase letters, digits, and hyphens (e.g. "mail", "order-processing").`,
        }),
      );
    }

    if (seenQueueNames.has(qName.toLowerCase())) {
      issues.push(
        issue({
          code: "queue.name.duplicate",
          message: `Duplicate queue name "${queue.name}". Queue names must be unique.`,
        }),
      );
    }
    seenQueueNames.add(qName.toLowerCase());

    if (queue.concurrency != null && (queue.concurrency < 1 || !Number.isInteger(queue.concurrency))) {
      issues.push(
        issue({
          code: "queue.concurrency.invalid",
          message: `Queue "${queue.name}" has invalid concurrency ${queue.concurrency}. Must be an integer >= 1.`,
        }),
      );
    }

    const seenJobNames = new Set<string>();

    for (const job of queue.jobs) {
      const jName = job.name.trim();

      if (!jName || !JOB_NAME_REGEX.test(jName)) {
        issues.push(
          issue({
            code: "queue.job.name.invalid",
            message: `Job name "${job.name}" in queue "${queue.name}" is invalid. Use camelCase (e.g. "sendWelcomeEmail").`,
          }),
        );
      }

      if (seenJobNames.has(jName.toLowerCase())) {
        issues.push(
          issue({
            code: "queue.job.name.duplicate",
            message: `Duplicate job name "${job.name}" in queue "${queue.name}".`,
          }),
        );
      }
      seenJobNames.add(jName.toLowerCase());

      if (job.attempts != null && (job.attempts < 1 || !Number.isInteger(job.attempts))) {
        issues.push(
          issue({
            code: "queue.job.attempts.invalid",
            message: `Job "${job.name}" in queue "${queue.name}" has invalid attempts ${job.attempts}. Must be an integer >= 1.`,
          }),
        );
      }

      if (job.backoffDelayMs != null && job.backoffDelayMs < 0) {
        issues.push(
          issue({
            code: "queue.job.backoffDelayMs.invalid",
            message: `Job "${job.name}" in queue "${queue.name}" has invalid backoff delay ${job.backoffDelayMs}. Must be >= 0.`,
          }),
        );
      }
    }
  }
}

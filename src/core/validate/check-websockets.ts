import type { Project } from "../model/schema";
import { issue, type ValidationIssue } from "./types";

const WS_PATH_REGEX = /^\/[a-zA-Z0-9/_-]*$/;

export function checkWebSockets(project: Project, issues: ValidationIssue[]): void {
  const wsConfig = project.settings.websockets;
  if (!wsConfig || !wsConfig.enabled) {
    return;
  }

  if (!wsConfig.path || !wsConfig.path.trim()) {
    issues.push(
      issue({
        code: "websockets.path.empty",
        message: "WebSocket path cannot be empty.",
      }),
    );
  } else if (!WS_PATH_REGEX.test(wsConfig.path.trim())) {
    issues.push(
      issue({
        code: "websockets.path.invalid",
        message: `WebSocket path "${wsConfig.path}" is invalid. Must start with "/" and use letters, numbers, hyphens, and slashes.`,
      }),
    );
  }

  if (!wsConfig.corsOrigin || !wsConfig.corsOrigin.trim()) {
    issues.push(
      issue({
        code: "websockets.corsOrigin.empty",
        message: "WebSocket CORS origin cannot be empty. Use \"*\" or specific origins.",
      }),
    );
  }
}

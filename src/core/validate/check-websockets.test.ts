import { describe, expect, it } from "vitest";
import { createProject } from "../model/defaults";
import { validateProject } from "./validate";

describe("checkWebSockets validation", () => {
  it("passes validation when websockets are disabled", () => {
    const project = createProject("No WS API");
    project.settings.websockets.enabled = false;
    const issues = validateProject(project);
    expect(issues.filter((i) => i.code.startsWith("websockets."))).toEqual([]);
  });

  it("validates path format when websockets are enabled", () => {
    const project = createProject("WS API");
    project.settings.websockets.enabled = true;
    project.settings.websockets.path = "";

    let issues = validateProject(project);
    expect(issues.some((i) => i.code === "websockets.path.empty")).toBe(true);

    project.settings.websockets.path = "no-leading-slash";
    issues = validateProject(project);
    expect(issues.some((i) => i.code === "websockets.path.invalid")).toBe(true);

    project.settings.websockets.path = "/events";
    issues = validateProject(project);
    expect(issues.filter((i) => i.code.startsWith("websockets."))).toEqual([]);
  });

  it("validates corsOrigin when websockets are enabled", () => {
    const project = createProject("WS API");
    project.settings.websockets.enabled = true;
    project.settings.websockets.corsOrigin = "   ";

    const issues = validateProject(project);
    expect(issues.some((i) => i.code === "websockets.corsOrigin.empty")).toBe(true);
  });
});

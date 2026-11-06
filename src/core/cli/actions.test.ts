import { describe, expect, it } from "vitest";
import type { ExportEntryStatus, ExportPlan, ExportPlanEntry } from "../export/plan";
import { conflictActions, conflictLine, issueLine, planReport, planSummary } from "./actions";

function entry(path: string, status: ExportEntryStatus): ExportPlanEntry {
  return {
    path,
    sha256: "hash",
    status,
    defaultStrategy: status === "unchanged" ? "skip" : "overwrite",
  };
}

function plan(entries: ExportPlanEntry[]): ExportPlan {
  const counts: ExportPlan["counts"] = {
    new: 0,
    untracked: 0,
    unchanged: 0,
    "generator-updated": 0,
    "disk-modified": 0,
    "missing-from-disk": 0,
  };
  for (const item of entries) counts[item.status] += 1;
  return { entries, counts };
}

describe("conflictActions", () => {
  it("skips conflicts under the safe policy", () => {
    const subject = plan([entry("src/main.ts", "disk-modified"), entry("README.md", "untracked")]);
    expect(conflictActions(subject, "safe")).toEqual({});
  });

  it("overwrites only conflicts under the overwrite policy", () => {
    const subject = plan([
      entry("src/main.ts", "disk-modified"),
      entry("README.md", "untracked"),
      entry("src/app.module.ts", "new"),
    ]);
    expect(conflictActions(subject, "overwrite")).toEqual({
      "src/main.ts": "overwrite",
      "README.md": "overwrite",
    });
  });
});

describe("planSummary", () => {
  it("lists counts in a stable order and drops zero rows", () => {
    const subject = plan([
      entry("a.ts", "new"),
      entry("b.ts", "new"),
      entry("c.ts", "unchanged"),
      entry("d.ts", "disk-modified"),
    ]);
    expect(planSummary(subject)).toBe("2 new · 1 unchanged · 1 changed on disk");
  });

  it("always shows new and unchanged", () => {
    expect(planSummary(plan([]))).toBe("0 new · 0 unchanged");
  });
});

describe("planReport", () => {
  it("reports conflicts in plan order with the chosen action", () => {
    const subject = plan([
      entry("src/main.ts", "disk-modified"),
      entry("README.md", "untracked"),
      entry("src/app.module.ts", "new"),
    ]);
    expect(planReport(subject, { "README.md": "overwrite" })).toEqual({
      counts: subject.counts,
      summary: "1 new · 0 unchanged · 1 changed on disk · 1 untracked",
      conflicts: [
        { path: "src/main.ts", status: "disk-modified", action: "skip" },
        { path: "README.md", status: "untracked", action: "overwrite" },
      ],
    });
  });
});

describe("conflictLine", () => {
  it("renders the action and the reason", () => {
    expect(conflictLine({ path: "src/main.ts", status: "disk-modified", action: "skip" })).toBe(
      "skip src/main.ts (changed on disk)",
    );
    expect(conflictLine({ path: "README.md", status: "untracked", action: "overwrite" })).toBe(
      "overwrite README.md (untracked)",
    );
    expect(conflictLine({ path: "a.ts", status: "disk-modified", action: "new" })).toBe(
      "write .new a.ts (changed on disk)",
    );
  });
});

describe("issueLine", () => {
  it("includes the fix hint when present", () => {
    expect(
      issueLine({
        code: "entity.duplicate",
        severity: "error",
        message: "Duplicate entity",
        fixHint: "Rename one entity",
      }),
    ).toBe("error entity.duplicate: Duplicate entity — Rename one entity");
  });

  it("omits an empty hint", () => {
    expect(issueLine({ code: "auth.roles", severity: "warning", message: "No admin role" })).toBe(
      "warning auth.roles: No admin role",
    );
  });
});

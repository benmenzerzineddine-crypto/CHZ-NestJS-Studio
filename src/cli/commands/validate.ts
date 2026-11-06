import { issueLine } from "../../core/cli/actions";
import {
  EXIT_INVALID_MODEL,
  EXIT_OK,
  type ValidateCommand,
} from "../../core/cli/args";
import { validateProject } from "../../core/validate/validate";
import { errorsOf, loadProject } from "../fs-utils";
import type { CliIO } from "../types";

export async function runValidate(
  command: ValidateCommand,
  io: CliIO,
): Promise<number> {
  const project = await loadProject(command.projectPath);
  const issues = validateProject(project);
  const errors = errorsOf(issues);
  const warnings = issues.filter((issue) => issue.severity === "warning");

  if (command.json) {
    io.out(
      JSON.stringify(
        {
          command: "validate",
          project: command.projectPath,
          packageName: project.packageName,
          errors: errors.length,
          warnings: warnings.length,
          issues,
        },
        null,
        2,
      ),
    );
    return errors.length > 0 ? EXIT_INVALID_MODEL : EXIT_OK;
  }

  for (const issue of issues) io.err(issueLine(issue));
  io.out(
    `${project.name} (${project.packageName}): ${errors.length} errors, ${warnings.length} warnings`,
  );
  return errors.length > 0 ? EXIT_INVALID_MODEL : EXIT_OK;
}

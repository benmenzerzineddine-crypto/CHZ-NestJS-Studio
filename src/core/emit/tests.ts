import type { GeneratedFile, ProjectIR } from "../ir/types";
import { emitAuthSpec } from "./tests/auth-spec";
import { emitAuthorizationSpec } from "./tests/authorization-spec";
import { emitEntitySpecs } from "./tests/crud-spec";
import { emitFactories } from "./tests/factories";
import {
  emitAuthUtils,
  emitDbUtils,
  emitHealthSpec,
  emitJestConfig,
  emitSetup,
} from "./tests/setup";

export {
  emitAuthSpec,
  emitAuthorizationSpec,
  emitAuthUtils,
  emitDbUtils,
  emitEntitySpecs,
  emitFactories,
  emitHealthSpec,
  emitJestConfig,
  emitSetup,
};

export function emitTests(ir: ProjectIR): GeneratedFile[] {
  if (!ir.project.settings.tests) return [];

  const files: GeneratedFile[] = [
    emitJestConfig(),
    emitSetup(ir),
    emitAuthUtils(ir),
    emitDbUtils(),
    emitFactories(ir),
    ...emitEntitySpecs(ir),
  ];
  if (ir.auth.enabled) {
    files.push(emitAuthSpec(ir), emitAuthorizationSpec(ir));
  } else {
    files.push(emitHealthSpec(ir));
  }
  return files;
}

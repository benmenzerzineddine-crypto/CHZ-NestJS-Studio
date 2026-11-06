import type { ProjectIR } from "../ir/types";
import { ENUMS_PATH, file } from "./helpers";
import type { GeneratedFile } from "../ir/types";

export function emitEnums(ir: ProjectIR): GeneratedFile {
  if (ir.enums.length === 0) {
    return file(ENUMS_PATH, "export {};\n");
  }

  const blocks = ir.enums.map((enumIR) => {
    const members = enumIR.values
      .map((value, index) => `  ${enumIR.members[index]} = ${JSON.stringify(value)},`)
      .join("\n");
    return `export enum ${enumIR.name} {\n${members}\n}`;
  });

  return file(ENUMS_PATH, `${blocks.join("\n\n")}\n`);
}

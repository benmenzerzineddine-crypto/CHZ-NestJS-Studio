import process from "node:process";

export interface CliIO {
  out: (text: string) => void;
  err: (text: string) => void;
}

export const processIo: CliIO = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
};

export class CliFailure extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "CliFailure";
    this.exitCode = exitCode;
  }
}

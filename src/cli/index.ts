import process from "node:process";
import { reportFailure, runCli } from "./run";

runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.exitCode = reportFailure(error);
  });

import { lintSdk, type SdkLintResult } from "@lab-core/sdk";
import { readOption } from "../shared/args.js";
import { EXIT_SUCCESS, EXIT_VALIDATION } from "../shared/error-codes.js";
import { printJson } from "../presenters/json.js";
import { printKeyValue, printList, printSection } from "../presenters/human.js";

export type LintResult = SdkLintResult;

export function runLintCommand(args: string[]): number {
  const profile = readOption(args, "profile");
  const format = readOption(args, "format") ?? "human";
  const result = runLintCore(process.cwd(), profile);

  if (format === "json") {
    printJson(result);
  } else {
    printSection("lint");
    printKeyValue("ok", String(result.ok));
    printKeyValue("compose", result.composePath);

    if (result.errors.length > 0) {
      printSection("errors");
      printList(result.errors);
    }

    if (result.warnings.length > 0) {
      printSection("warnings");
      printList(result.warnings);
    }
  }

  return result.ok ? EXIT_SUCCESS : EXIT_VALIDATION;
}

export function executeLint(cwd: string, requestedProfile?: string): LintResult {
  return runLintCore(cwd, requestedProfile);
}

function runLintCore(cwd: string, requestedProfile?: string): LintResult {
  return lintSdk({ cwd, profile: requestedProfile });
}

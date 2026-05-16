import { installGitHubActionsTemplate } from "@lab-core/sdk-ci";
import { hasFlag } from "../shared/args.js";
import { EXIT_FAILURE, EXIT_SUCCESS } from "../shared/error-codes.js";

export function runCiInstallCommand(args: string[]): number {
  try {
    const force = hasFlag(args, "force");
    const result = installGitHubActionsTemplate(process.cwd(), force);
    process.stdout.write(`${result.written ? "installed" : "already exists"}: ${result.path}\n`);
    return EXIT_SUCCESS;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}

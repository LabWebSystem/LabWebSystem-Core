import { runSeedAction } from "@lab-core/sdk-seed";
import { readOption } from "../shared/args.js";
import { loadContext } from "../shared/context.js";
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_VALIDATION } from "../shared/error-codes.js";

export async function runSeedCommand(args: string[]): Promise<number> {
  const action = args[0];
  if (action !== "apply" && action !== "verify" && action !== "reset") {
    process.stderr.write("seed action must be one of: apply, verify, reset\n");
    return EXIT_FAILURE;
  }

  const profile = readOption(args, "profile");

  try {
    const context = loadContext(process.cwd(), profile);
    const result = await runSeedAction(context.cwd, context.profileName, action);
    process.stdout.write(`${result.message}\n`);
    if (!result.executed) {
      process.stdout.write("hint: add labcore/seeds/<action>.sh\n");
      return EXIT_SUCCESS;
    }
    return result.exitCode === 0 ? EXIT_SUCCESS : EXIT_VALIDATION;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}

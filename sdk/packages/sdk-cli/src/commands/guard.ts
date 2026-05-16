import { guardProdProfile } from "@lab-core/sdk-profile";
import { readOption } from "../shared/args.js";
import { loadContext } from "../shared/context.js";
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_VALIDATION } from "../shared/error-codes.js";
import { printList, printSection } from "../presenters/human.js";

export function runGuardCommand(args: string[]): number {
  const target = args[0] ?? "prod";
  if (target !== "prod") {
    process.stderr.write(`unsupported guard target: ${target}\n`);
    return EXIT_FAILURE;
  }

  const profile = readOption(args, "profile") ?? "prod";

  try {
    const context = loadContext(process.cwd(), profile);
    const result = guardProdProfile(context.resolved);

    printSection("guard prod");
    if (result.ok) {
      process.stdout.write("ok\n");
      return EXIT_SUCCESS;
    }

    printList(result.violations);
    return EXIT_VALIDATION;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}

import fs from "node:fs";
import path from "node:path";
import { buildExportPayload } from "@lab-core/sdk-profile";
import { readOption } from "../shared/args.js";
import { loadContext } from "../shared/context.js";
import { EXIT_FAILURE, EXIT_SUCCESS } from "../shared/error-codes.js";
import { printJson } from "../presenters/json.js";

export function runExportCommand(args: string[]): number {
  const profile = readOption(args, "profile");
  const outputPath = readOption(args, "out");

  try {
    const context = loadContext(process.cwd(), profile);
    const payload = buildExportPayload(context.resolved);

    if (!outputPath) {
      printJson(payload);
      return EXIT_SUCCESS;
    }

    const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
    fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote: ${resolvedOutputPath}\n`);
    return EXIT_SUCCESS;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}

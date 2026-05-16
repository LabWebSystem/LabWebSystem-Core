import fs from "node:fs";
import path from "node:path";
import { inspectComposeFile } from "@lab-core/sdk-inspect";
import { readOption } from "../shared/args.js";
import { loadContext } from "../shared/context.js";
import { EXIT_FAILURE, EXIT_SUCCESS } from "../shared/error-codes.js";
import { printJson } from "../presenters/json.js";
import { printKeyValue, printList, printSection } from "../presenters/human.js";

export function runInspectCommand(args: string[]): number {
  const profile = readOption(args, "profile");
  const format = readOption(args, "format") ?? "human";

  try {
    const context = loadContext(process.cwd(), profile);
    const composePath = context.resolved.composeFiles[0] ?? context.resolved.manifest.deployment.composePath;
    const absolutePath = path.resolve(context.cwd, composePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`compose file not found: ${composePath}`);
    }

    const inspection = inspectComposeFile({
      absolutePath,
      composeCandidates: context.resolved.composeFiles,
      yamlFiles: context.resolved.composeFiles,
      recommendedComposePath: composePath,
      selectedComposePath: composePath
    });

    if (format === "json") {
      printJson(inspection);
      return EXIT_SUCCESS;
    }

    printSection("inspect");
    printKeyValue("profile", context.profileName);
    printKeyValue("compose", composePath);
    printKeyValue("parseError", inspection.parseError ?? "none");

    printSection("services");
    const services = inspection.services.map((service) => `${service.name} (port=${service.detectedPublicPort ?? "n/a"})`);
    if (services.length === 0) {
      printList(["no services"]);
    } else {
      printList(services);
    }

    if (inspection.environmentRequirements.length > 0) {
      printSection("environment requirements");
      printList(
        inspection.environmentRequirements.map((requirement) =>
          `${requirement.name} (${requirement.required ? "required" : "optional"})`
        )
      );
    }

    if (inspection.detectedDeviceRequirements.length > 0) {
      printSection("detected device requirements");
      printList(inspection.detectedDeviceRequirements);
    }

    return EXIT_SUCCESS;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}

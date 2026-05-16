import fs from "node:fs";
import path from "node:path";
import { inspectComposeFile, validateComposeServiceSelection, validateEnvironmentOverrides, type ComposeInspectionResult } from "@lab-core/sdk-inspect";
import { readOption } from "../shared/args.js";
import { loadContext } from "../shared/context.js";
import { EXIT_SUCCESS, EXIT_VALIDATION } from "../shared/error-codes.js";
import { printJson } from "../presenters/json.js";
import { printKeyValue, printList, printSection } from "../presenters/human.js";

export type LintResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  inspection: ComposeInspectionResult | null;
  composePath: string;
};

function runLintCore(cwd: string, requestedProfile?: string): LintResult {
  const context = loadContext(cwd, requestedProfile);
  const errors: string[] = [];
  const warnings: string[] = [];

  const composePath = context.resolved.composeFiles[0] ?? context.resolved.manifest.deployment.composePath;
  const composeAbsolutePath = path.resolve(cwd, composePath);

  if (!fs.existsSync(composeAbsolutePath)) {
    errors.push(`compose file not found: ${composePath}`);
    return {
      ok: false,
      errors,
      warnings,
      inspection: null,
      composePath
    };
  }

  const inspection = inspectComposeFile({
    absolutePath: composeAbsolutePath,
    composeCandidates: context.resolved.composeFiles,
    yamlFiles: context.resolved.composeFiles,
    recommendedComposePath: composePath,
    selectedComposePath: composePath
  });

  if (inspection.parseError) {
    errors.push(`compose parse error: ${inspection.parseError}`);
  }

  try {
    validateComposeServiceSelection(inspection, context.resolved.manifest.exposure.service, composePath);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "invalid compose service selection");
  }

  try {
    validateEnvironmentOverrides(inspection, context.resolved.envOverrides);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "invalid env overrides");
  }

  const service = inspection.services.find((candidate) => candidate.name === context.resolved.manifest.exposure.service);
  if (service && service.portOptions.length > 0 && !service.portOptions.includes(context.resolved.manifest.exposure.port)) {
    warnings.push(
      `exposure port ${context.resolved.manifest.exposure.port} is not found in service ports (${service.portOptions.join(", ")})`
    );
  }

  const missingManifestEnv = context.resolved.manifest.env.required.filter((name) => {
    const value = context.resolved.envOverrides[name];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missingManifestEnv.length > 0) {
    errors.push(`manifest required env is missing: ${missingManifestEnv.join(", ")}`);
  }

  const missingDevicePaths = context.resolved.manifest.devices.required.filter((device) => !context.resolved.deviceRequirements.includes(device));
  if (missingDevicePaths.length > 0) {
    errors.push(`missing device requirements: ${missingDevicePaths.join(", ")}`);
  }

  warnings.push(...inspection.parseWarnings.map((entry) => `parse warning: ${entry}`));
  warnings.push(...inspection.analysisWarnings.map((entry) => `analysis warning: ${entry}`));

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    inspection,
    composePath
  };
}

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

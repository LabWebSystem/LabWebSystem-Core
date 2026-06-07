import fs from "node:fs";
import path from "node:path";
import {
  loadManifest,
  loadProfile,
  resolveProfileName,
  type Manifest,
  type ProfileConfig,
  type ExportPayload
} from "@lab-core/sdk-contract";
import {
  inspectComposeFile,
  validateComposeServiceSelection,
  validateEnvironmentOverrides,
  type ComposeInspectionResult
} from "@lab-core/sdk-inspect";
import {
  mergeProfile,
  guardProdProfile,
  buildExportPayload,
  type GuardResult,
  type ResolvedProfile
} from "@lab-core/sdk-profile";
import { runSeedAction, type SeedAction, type SeedResult } from "@lab-core/sdk-seed";
import { collectOperationalWarnings } from "./operational-warnings.js";

export type SdkContext = {
  cwd: string;
  manifestPath: string;
  profilePath: string;
  manifest: Manifest;
  profile: ProfileConfig;
  resolved: ResolvedProfile;
};

export type SdkLintResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  inspection: ComposeInspectionResult | null;
  composePath: string;
};

export function loadSdkContext(options: { cwd?: string; profile?: string } = {}): SdkContext {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const { path: manifestPath, manifest } = loadManifest(cwd);
  const profileName = resolveProfileName(manifest, options.profile);
  const { path: profilePath, profile } = loadProfile(cwd, profileName);
  const resolved = mergeProfile(manifest, profile);

  return {
    cwd,
    manifestPath,
    profilePath,
    manifest,
    profile,
    resolved
  };
}

function inspectFromContext(context: SdkContext): { composePath: string; inspection: ComposeInspectionResult } {
  const composePath = context.resolved.composeFiles[0] ?? context.resolved.manifest.deployment.composePath;
  const composeAbsolutePath = path.resolve(context.cwd, composePath);

  if (!fs.existsSync(composeAbsolutePath)) {
    throw new Error(`compose file not found: ${composePath}`);
  }

  const inspection = inspectComposeFile({
    absolutePath: composeAbsolutePath,
    composeCandidates: context.resolved.composeFiles,
    yamlFiles: context.resolved.composeFiles,
    recommendedComposePath: composePath,
    selectedComposePath: composePath
  });

  return { composePath, inspection };
}

export function inspectSdk(options: { cwd?: string; profile?: string } = {}): ComposeInspectionResult {
  const context = loadSdkContext(options);
  return inspectFromContext(context).inspection;
}

export function lintSdk(options: { cwd?: string; profile?: string } = {}): SdkLintResult {
  const context = loadSdkContext(options);
  const errors: string[] = [];
  const warnings: string[] = [];

  let inspection: ComposeInspectionResult | null = null;
  let composePath = context.resolved.manifest.deployment.composePath;

  try {
    const inspected = inspectFromContext(context);
    composePath = inspected.composePath;
    inspection = inspected.inspection;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (!inspection) {
    return {
      ok: false,
      errors,
      warnings,
      inspection: null,
      composePath
    };
  }

  if (inspection.parseError) {
    errors.push(`compose parse error: ${inspection.parseError}`);
  }

  try {
    validateComposeServiceSelection(inspection, context.resolved.manifest.exposure.service, composePath);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    validateEnvironmentOverrides(inspection, context.resolved.envOverrides);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const service = inspection.services.find((candidate) => candidate.name === context.resolved.manifest.exposure.service);
  if (service && service.portOptions.length > 0 && !service.portOptions.includes(context.resolved.manifest.exposure.port)) {
    warnings.push(
      `exposure port ${context.resolved.manifest.exposure.port} is not included in compose service ports (${service.portOptions.join(", ")})`
    );
  }

  const missingManifestEnv = context.resolved.manifest.env.required.filter((name) => {
    const value = context.resolved.envOverrides[name];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missingManifestEnv.length > 0) {
    errors.push(`manifest required env is missing: ${missingManifestEnv.join(", ")}`);
  }

  const missingDevicePaths = context.resolved.manifest.devices.required.filter((devicePath) =>
    !context.resolved.deviceRequirements.includes(devicePath)
  );
  if (missingDevicePaths.length > 0) {
    errors.push(`missing device requirements: ${missingDevicePaths.join(", ")}`);
  }

  warnings.push(...inspection.parseWarnings.map((entry) => `parse warning: ${entry}`));
  warnings.push(...inspection.analysisWarnings.map((entry) => `analysis warning: ${entry}`));
  warnings.push(...collectOperationalWarnings({
    composePath,
    inspection,
    manifest: context.manifest,
    resolved: context.resolved
  }));

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    inspection,
    composePath
  };
}

export function guardProdSdk(options: { cwd?: string; profile?: string } = {}): GuardResult {
  const context = loadSdkContext({ ...options, profile: options.profile ?? "prod" });
  return guardProdProfile(context.resolved);
}

export function exportSdkPayload(options: { cwd?: string; profile?: string } = {}): ExportPayload {
  const context = loadSdkContext(options);
  return buildExportPayload(context.resolved);
}

export async function runSdkSeed(action: SeedAction, options: { cwd?: string; profile?: string } = {}): Promise<SeedResult> {
  const context = loadSdkContext(options);
  return runSeedAction(context.cwd, context.profile.profile, action);
}

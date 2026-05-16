import { exportPayloadSchema, type ExportPayload } from "@lab-core/sdk-contract";
import type { ResolvedProfile } from "./merge-profile.js";

export function buildExportPayload(resolved: ResolvedProfile): ExportPayload {
  const payload = {
    name: resolved.manifest.app.name,
    description: resolved.manifest.app.description ?? "",
    repositoryUrl: resolved.manifest.repository.url,
    defaultBranch: resolved.manifest.repository.defaultBranch,
    composePath: resolved.composeFiles[0] ?? resolved.manifest.deployment.composePath,
    publicServiceName: resolved.manifest.exposure.service,
    publicPort: resolved.manifest.exposure.port,
    hostname: resolved.manifest.exposure.hostname,
    mode: resolved.manifest.deployment.mode,
    keepVolumesOnRebuild: resolved.manifest.deployment.keepVolumesOnRebuild,
    deviceRequirements: resolved.deviceRequirements,
    envOverrides: resolved.envOverrides
  };

  return exportPayloadSchema.parse(payload);
}

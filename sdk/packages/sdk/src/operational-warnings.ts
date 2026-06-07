import type { Manifest } from "@lab-core/sdk-contract";
import type { ComposeInspectionResult } from "@lab-core/sdk-inspect";
import type { ResolvedProfile } from "@lab-core/sdk-profile";

type OperationalWarningsInput = {
  composePath: string;
  inspection: ComposeInspectionResult;
  manifest: Manifest;
  resolved: ResolvedProfile;
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function containsLocalhost(value: string): boolean {
  return /(?:https?:\/\/)?localhost(?::\d+)?(?:\/|$)/i.test(value.trim());
}

function isDevelopmentComposePath(pathValue: string): boolean {
  const normalized = normalizePath(pathValue).toLowerCase();
  return normalized.includes(".dev.") || normalized.endsWith("/docker-compose.dev.yml") || normalized.endsWith("/docker-compose.dev.yaml");
}

export function collectOperationalWarnings(input: OperationalWarningsInput): string[] {
  const warnings: string[] = [];
  const normalizedComposePath = normalizePath(input.composePath);
  const normalizedDeploymentPath = normalizePath(input.manifest.deployment.composePath);

  if (
    normalizedComposePath === normalizedDeploymentPath
    && input.inspection.services.some((service) => service.publishedPorts.length > 0)
  ) {
    warnings.push(
      `deployment compose ${input.composePath} publishes host ports. Prefer internal expose only and move localhost ports to docker-compose.dev.yml.`
    );
  }

  const localhostEnvReferences = Object.entries(input.resolved.envOverrides)
    .filter(([, value]) => containsLocalhost(value))
    .map(([name, value]) => `${name}=${value}`);

  if (localhostEnvReferences.length > 0) {
    warnings.push(
      `resolved env contains localhost references: ${localhostEnvReferences.join(", ")}. Prefer same-origin /api or service DNS names for deployed apps.`
    );
  }

  if (containsLocalhost(input.inspection.rawYaml)) {
    warnings.push(
      `compose file ${input.composePath} contains localhost references. Browser-facing configs should not target localhost in deployed apps.`
    );
  }

  const apiBaseUrl = input.resolved.envOverrides.VITE_API_BASE_URL?.trim() ?? "";
  if (apiBaseUrl.length > 0 && apiBaseUrl !== "/") {
    warnings.push(
      `VITE_API_BASE_URL=${apiBaseUrl} is not same-origin. Prefer '/' or an empty string so the frontend can call /api on the current host.`
    );
  }

  if (!/\bAPPDATA_ROOT\b/.test(input.inspection.rawYaml)) {
    warnings.push(
      `compose file ${input.composePath} does not reference APPDATA_ROOT. Prefer bind-mounting persistent data to ../../appdata/<app-name> for LabWebSystem deployments.`
    );
  }

  if (input.resolved.profileName === "prod") {
    if (!hasText(input.resolved.envOverrides.LABCORE_DEVICE_MODE)) {
      warnings.push(
        "prod profile does not set LABCORE_DEVICE_MODE. Set it explicitly to 'real' so guard prod does not fall back to mock for non-device apps."
      );
    }

    const developmentComposeFiles = input.resolved.composeFiles.filter((entry) => isDevelopmentComposePath(entry));
    if (developmentComposeFiles.length > 0) {
      warnings.push(
        `prod profile includes development compose files: ${developmentComposeFiles.join(", ")}. Keep prod limited to deployment compose files.`
      );
    }

    if (
      input.manifest.exposure.hostname === "lab.localhost"
      || input.manifest.exposure.hostname.endsWith(".lab.localhost")
    ) {
      warnings.push(
        `exposure.hostname is still ${input.manifest.exposure.hostname}. Update it to app.<LAB_CORE_ROOT_DOMAIN> before production registration.`
      );
    }
  }

  return [...new Set(warnings)];
}

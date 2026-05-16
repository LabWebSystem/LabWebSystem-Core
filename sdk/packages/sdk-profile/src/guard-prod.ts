import { resolveDeviceMode } from "./resolve-device-mode.js";
import type { ResolvedProfile } from "./merge-profile.js";

export type GuardResult = {
  ok: boolean;
  violations: string[];
};

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return !["0", "false", "no", "off", ""].includes(value.trim().toLowerCase());
}

function detectMockFlags(envOverrides: Record<string, string>): string[] {
  return Object.entries(envOverrides)
    .filter(([key, value]) => key.toUpperCase().includes("MOCK") && isTruthy(value))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));
}

function detectDevComposeFiles(composeFiles: string[]): string[] {
  return composeFiles.filter((file) => /(^|\/)docker-compose\.dev\.ya?ml$|(^|\/)compose\.dev\.ya?ml$|\.dev\.ya?ml$/i.test(file));
}

export function guardProdProfile(resolved: ResolvedProfile): GuardResult {
  const violations: string[] = [];
  const mockFlags = detectMockFlags(resolved.envOverrides);
  const deviceMode = resolveDeviceMode(resolved.envOverrides, resolved.deviceRequirements.length);

  if (!resolved.guard.allowMock) {
    if (deviceMode === "mock") {
      violations.push("LABCORE_DEVICE_MODE が mock です (prod では real が必要)");
    }
    if (mockFlags.length > 0) {
      violations.push(`mock 用環境変数が有効です: ${mockFlags.join(", ")}`);
    }
  }

  const devComposeFiles = detectDevComposeFiles(resolved.composeFiles);
  if (devComposeFiles.length > 0) {
    violations.push(`dev 用 compose が含まれています: ${devComposeFiles.join(", ")}`);
  }

  const missingRequiredEnv = resolved.manifest.env.required.filter((name) => {
    const value = resolved.envOverrides[name];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missingRequiredEnv.length > 0) {
    violations.push(`必須環境変数が不足しています: ${missingRequiredEnv.join(", ")}`);
  }

  const missingDevicePaths = resolved.guard.requireDevicePaths.filter((path) => !resolved.deviceRequirements.includes(path));
  if (missingDevicePaths.length > 0) {
    violations.push(`必須デバイス要件が不足しています: ${missingDevicePaths.join(", ")}`);
  }

  return {
    ok: violations.length === 0,
    violations
  };
}

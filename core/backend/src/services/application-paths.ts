import fs from "node:fs";
import path from "node:path";
import { env } from "../lib/env.js";

export const applicationIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/;
export const normalizedComposeFilename = "docker-compose.normalized.yaml";
export const generatedEnvFilename = "compose.env";
export const recoveryDescriptorFilename = "state.json";

export function assertSafeApplicationId(applicationId: string): void {
  if (!applicationIdPattern.test(applicationId)) {
    throw new Error(`安全でない application_id です: ${applicationId}`);
  }
}

export function getApplicationRoot(applicationId: string): string {
  assertSafeApplicationId(applicationId);
  return path.join(env.appsRoot, applicationId);
}

export function getApplicationSourceRoot(applicationId: string): string {
  return path.join(getApplicationRoot(applicationId), "repository");
}

export function getApplicationDataRoot(applicationId: string): string {
  assertSafeApplicationId(applicationId);
  return path.join(env.appDataRoot, applicationId);
}

export function getApplicationVolumesRoot(applicationId: string): string {
  return path.join(getApplicationDataRoot(applicationId), "volumes");
}

export function getApplicationLabCoreRoot(applicationId: string): string {
  return path.join(getApplicationRoot(applicationId), ".lab-core");
}

export function getNormalizedComposePath(applicationId: string): string {
  return path.join(getApplicationLabCoreRoot(applicationId), normalizedComposeFilename);
}

export function getGeneratedComposeEnvPath(applicationId: string): string {
  return path.join(getApplicationLabCoreRoot(applicationId), generatedEnvFilename);
}

export function getRecoveryDescriptorPath(applicationId: string): string {
  return path.join(getApplicationRoot(applicationId), recoveryDescriptorFilename);
}

export function ensureApplicationRuntimeLayout(applicationId: string): void {
  const appRoot = getApplicationRoot(applicationId);
  const sourceRoot = getApplicationSourceRoot(applicationId);
  const dataRoot = getApplicationDataRoot(applicationId);
  const volumesRoot = getApplicationVolumesRoot(applicationId);
  const labCoreRoot = getApplicationLabCoreRoot(applicationId);

  fs.mkdirSync(appRoot, { recursive: true });
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(volumesRoot, { recursive: true });
  fs.mkdirSync(labCoreRoot, { recursive: true, mode: 0o700 });

  try {
    fs.chmodSync(labCoreRoot, 0o700);
  } catch {
    // chmod 非対応環境では既定値を使用する。
  }
}

export function isPathWithin(candidate: string, container: string): boolean {
  const relative = path.relative(container, candidate);
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function getExistingAncestorRealPath(targetPath: string): string {
  let current = path.resolve(targetPath);

  while (true) {
    if (fs.existsSync(current)) {
      return fs.realpathSync.native(current);
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
}

import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { manifestSchema, type Manifest } from "./manifest-schema.js";
import { profileSchema, type ProfileConfig } from "./profile-schema.js";

export const DEFAULT_MANIFEST_PATH = "labcore.app.yaml";
export const PROFILE_DIR = path.join("labcore", "profiles");

function readYaml(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf8");
  return parse(raw);
}

export function loadManifest(cwd: string, manifestPath = DEFAULT_MANIFEST_PATH): { path: string; manifest: Manifest } {
  const resolvedPath = path.resolve(cwd, manifestPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`manifest not found: ${resolvedPath}`);
  }

  const parsed = manifestSchema.safeParse(readYaml(resolvedPath));
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
    throw new Error(`schema validation failed (${manifestPath}): ${details}`);
  }

  const manifest = parsed.data;
  return { path: resolvedPath, manifest };
}

export function resolveProfileName(manifest: Manifest, requestedProfile?: string): string {
  const name = (requestedProfile ?? manifest.profiles.default).trim();
  if (name.length === 0) {
    throw new Error("profile name is empty");
  }
  return name;
}

export function loadProfile(cwd: string, profileName: string): { path: string; profile: ProfileConfig } {
  const profilePath = path.resolve(cwd, PROFILE_DIR, `${profileName}.yaml`);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`profile not found: ${profilePath}`);
  }

  const parsed = profileSchema.safeParse(readYaml(profilePath));
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
    throw new Error(`schema validation failed (${path.relative(cwd, profilePath)}): ${details}`);
  }

  const profile = parsed.data;
  if (profile.profile !== profileName) {
    throw new Error(`profile mismatch: expected ${profileName}, got ${profile.profile}`);
  }
  return { path: profilePath, profile };
}

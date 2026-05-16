import type { Manifest, ProfileConfig } from "@lab-core/sdk-contract";

export type ResolvedProfile = {
  profileName: string;
  manifest: Manifest;
  profile: ProfileConfig;
  composeFiles: string[];
  envOverrides: Record<string, string>;
  deviceRequirements: string[];
  guard: {
    allowMock: boolean;
    requireDevicePaths: string[];
  };
};

export function mergeProfile(manifest: Manifest, profile: ProfileConfig): ResolvedProfile {
  const composeFiles = profile.overrides.composeFiles.length > 0
    ? [...profile.overrides.composeFiles]
    : [manifest.deployment.composePath];

  const envOverrides = {
    ...manifest.env.defaults,
    ...profile.overrides.env
  };

  const deviceRequirements = profile.overrides.deviceRequirements.length > 0
    ? [...profile.overrides.deviceRequirements]
    : [...manifest.devices.required];

  return {
    profileName: profile.profile,
    manifest,
    profile,
    composeFiles,
    envOverrides,
    deviceRequirements,
    guard: {
      allowMock: profile.overrides.guard.allowMock,
      requireDevicePaths: [...profile.overrides.guard.requireDevicePaths]
    }
  };
}

import path from "node:path";
import { loadManifest, loadProfile, resolveProfileName } from "@lab-core/sdk-contract";
import { mergeProfile } from "@lab-core/sdk-profile";

export type LoadedContext = {
  cwd: string;
  manifestPath: string;
  profilePath: string;
  profileName: string;
  resolved: ReturnType<typeof mergeProfile>;
};

export function loadContext(cwd: string, requestedProfile?: string): LoadedContext {
  const { path: manifestPath, manifest } = loadManifest(cwd);
  const profileName = resolveProfileName(manifest, requestedProfile);
  const { path: profilePath, profile } = loadProfile(cwd, profileName);
  const resolved = mergeProfile(manifest, profile);

  return {
    cwd: path.resolve(cwd),
    manifestPath,
    profilePath,
    profileName,
    resolved
  };
}

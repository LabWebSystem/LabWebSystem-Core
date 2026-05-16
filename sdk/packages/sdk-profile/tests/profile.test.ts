import test from "node:test";
import assert from "node:assert/strict";
import { mergeProfile, guardProdProfile } from "../src/index.js";
import type { Manifest, ProfileConfig } from "@lab-core/sdk-contract";

const baseManifest: Manifest = {
  schemaVersion: 1,
  app: { name: "demo", description: "" },
  repository: { url: "https://github.com/example/repo.git", defaultBranch: "main" },
  deployment: { composePath: "docker-compose.yml", mode: "standard", keepVolumesOnRebuild: true },
  exposure: { service: "web", port: 3000, hostname: "demo.fukaya-sus.lab" },
  devices: { required: ["/dev/bus/usb"] },
  env: { required: ["ADMIN_FIXED_PASSWORD"], defaults: {} },
  profiles: { default: "dev-sim" }
};

test("guard detects mock mode for prod", () => {
  const profile: ProfileConfig = {
    profile: "prod",
    overrides: {
      env: { LABCORE_DEVICE_MODE: "mock", ADMIN_FIXED_PASSWORD: "x" },
      composeFiles: ["docker-compose.yml", "docker-compose.dev.yml"],
      deviceRequirements: ["/dev/bus/usb"],
      guard: { allowMock: false, requireDevicePaths: ["/dev/bus/usb"] }
    }
  };

  const resolved = mergeProfile(baseManifest, profile);
  const result = guardProdProfile(resolved);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((entry) => entry.includes("mock")));
});

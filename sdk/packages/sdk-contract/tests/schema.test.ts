import test from "node:test";
import assert from "node:assert/strict";
import { manifestSchema, profileSchema } from "../src/index.js";

test("manifest schema accepts minimal payload", () => {
  const result = manifestSchema.parse({
    schemaVersion: 1,
    app: { name: "demo" },
    repository: { url: "https://github.com/example/repo.git", defaultBranch: "main" },
    deployment: { composePath: "docker-compose.yml", mode: "standard", keepVolumesOnRebuild: true },
    exposure: { service: "web", port: 3000, hostname: "demo.fukaya-sus.lab" },
    devices: { required: [] },
    env: { required: [], defaults: {} },
    profiles: { default: "dev-sim" }
  });

  assert.equal(result.app.name, "demo");
});

test("profile schema accepts prod guard", () => {
  const result = profileSchema.parse({
    profile: "prod",
    overrides: {
      guard: {
        allowMock: false,
        requireDevicePaths: ["/dev/bus/usb"]
      }
    }
  });

  assert.equal(result.profile, "prod");
  assert.deepEqual(result.overrides.guard.requireDevicePaths, ["/dev/bus/usb"]);
});

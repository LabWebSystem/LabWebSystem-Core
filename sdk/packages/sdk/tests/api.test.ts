import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exportSdkPayload, lintSdk } from "../src/index.js";

function setupFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "labcore-sdk-lib-"));
  fs.mkdirSync(path.join(root, "labcore", "profiles"), { recursive: true });

  fs.writeFileSync(
    path.join(root, "labcore.app.yaml"),
    `schemaVersion: 1
app:
  name: demo-app
  description: demo
repository:
  url: https://github.com/example/demo-app.git
  defaultBranch: main
deployment:
  composePath: docker-compose.yml
  mode: standard
  keepVolumesOnRebuild: true
exposure:
  service: web
  port: 3000
  hostname: demo-app.fukaya-sus.lab
devices:
  required: []
env:
  required:
    - ADMIN_FIXED_PASSWORD
  defaults:
    LOG_LEVEL: info
profiles:
  default: dev-sim
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(root, "labcore", "profiles", "dev-sim.yaml"),
    `profile: dev-sim
overrides:
  env:
    ADMIN_FIXED_PASSWORD: pass
  composeFiles:
    - docker-compose.yml
  deviceRequirements: []
  guard:
    allowMock: true
    requireDevicePaths: []
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(root, "docker-compose.yml"),
    `services:
  web:
    image: nginx:alpine
    expose:
      - "3000"
`,
    "utf8"
  );

  return root;
}

test("exportSdkPayload returns lab-core create payload", () => {
  const cwd = setupFixture();
  const payload = exportSdkPayload({ cwd, profile: "dev-sim" });
  assert.equal(payload.name, "demo-app");
  assert.equal(payload.publicServiceName, "web");
  assert.equal(payload.publicPort, 3000);
});

test("lintSdk validates fixture as ok", () => {
  const cwd = setupFixture();
  const result = lintSdk({ cwd, profile: "dev-sim" });
  assert.equal(result.ok, true);
});

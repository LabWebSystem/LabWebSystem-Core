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

test("lintSdk reports operational deployment warnings", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "labcore-sdk-lib-warnings-"));
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
  hostname: demo-app.lab.localhost
devices:
  required: []
env:
  required: []
  defaults:
    VITE_API_BASE_URL: http://localhost:8787
profiles:
  default: prod
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(root, "labcore", "profiles", "prod.yaml"),
    `profile: prod
overrides:
  env: {}
  composeFiles:
    - docker-compose.yml
    - docker-compose.dev.yml
  deviceRequirements: []
  guard:
    allowMock: false
    requireDevicePaths: []
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(root, "docker-compose.yml"),
    `services:
  web:
    image: nginx:alpine
    ports:
      - "5180:3000"
    environment:
      VITE_PROXY_TARGET: http://localhost:8787
`,
    "utf8"
  );

  const result = lintSdk({ cwd: root, profile: "prod" });
  assert.equal(result.ok, true);
  assert.match(result.warnings.join("\n"), /publishes host ports/);
  assert.match(result.warnings.join("\n"), /localhost references/);
  assert.match(result.warnings.join("\n"), /VITE_API_BASE_URL=http:\/\/localhost:8787 is not same-origin/);
  assert.match(result.warnings.join("\n"), /does not reference APPDATA_ROOT/);
  assert.match(result.warnings.join("\n"), /does not set LABCORE_DEVICE_MODE/);
  assert.match(result.warnings.join("\n"), /includes development compose files/);
  assert.match(result.warnings.join("\n"), /exposure\.hostname is still demo-app\.lab\.localhost/);
});

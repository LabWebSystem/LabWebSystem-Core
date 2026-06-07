import test from "node:test";
import assert from "node:assert/strict";
import {
  findLabcoreManifestPath,
  parseLabcoreManifest
} from "../services/import-manifest.js";

test("finds the single labcore manifest path", () => {
  const manifestPath = findLabcoreManifestPath([
    "README.md",
    "docker-compose.yml",
    "labcore.app.yaml",
    "labcore/profiles/prod.yaml"
  ]);

  assert.equal(manifestPath, "labcore.app.yaml");
});

test("rejects repositories without labcore manifest", () => {
  assert.throws(
    () => findLabcoreManifestPath(["README.md", "docker-compose.yml"]),
    /labcore\.app\.yaml が見つかりません/
  );
});

test("rejects repositories with multiple labcore manifests", () => {
  assert.throws(
    () => findLabcoreManifestPath(["labcore.app.yaml", "examples/labcore.app.yaml"]),
    /labcore\.app\.yaml が複数見つかりました/
  );
});

test("parses labcore manifest schema", () => {
  const manifest = parseLabcoreManifest(
    `
schemaVersion: 1
app:
  name: sample-app
  description: sample description
repository:
  url: https://github.com/example/sample-app.git
  defaultBranch: main
deployment:
  composePath: docker-compose.yml
  mode: standard
  keepVolumesOnRebuild: true
exposure:
  service: web
  port: 3000
  hostname: sample.lab.localhost
devices:
  required:
    - /dev/bus/usb
env:
  required:
    - ADMIN_PASSWORD
  defaults:
    LOG_LEVEL: info
profiles:
  default: dev-sim
`,
    "labcore.app.yaml"
  );

  assert.equal(manifest.app.name, "sample-app");
  assert.equal(manifest.deployment.composePath, "docker-compose.yml");
  assert.deepEqual(manifest.devices.required, ["/dev/bus/usb"]);
  assert.equal(manifest.env.defaults.LOG_LEVEL, "info");
});

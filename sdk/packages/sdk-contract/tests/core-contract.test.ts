import test from "node:test";
import assert from "node:assert/strict";
import {
  coreConfigSchema,
  labWebSystemLabels,
  recoveryDescriptorSchema,
  releaseManifestSchema
} from "../src/index.js";

test("core config contract requires an absolute data directory", () => {
  assert.equal(
    coreConfigSchema.safeParse({
      configSchemaVersion: 1,
      installationId: "installation-1",
      primaryDomain: "example.test",
      dataDirectory: "/var/lib/labwebsystem"
    }).success,
    true
  );
  assert.equal(
    coreConfigSchema.safeParse({
      configSchemaVersion: 1,
      installationId: "installation-1",
      primaryDomain: "example.test",
      dataDirectory: "./runtime"
    }).success,
    false
  );
});

test("release and recovery contracts expose independent schema versions", () => {
  const release = releaseManifestSchema.parse({
    manifestSchemaVersion: 1,
    labWebSystemVersion: "0.8.0",
    configSchemaVersion: 1,
    databaseSchemaVersion: 12,
    recoveryDescriptorSchemaVersion: 1,
    minimumLwsctlVersion: "0.4.0",
    platforms: ["linux/amd64"],
    images: {
      backend: { reference: "ghcr.io/labwebsystem/backend:0.8.0" },
      dashboard: { reference: "ghcr.io/labwebsystem/dashboard:0.8.0" }
    },
    compose: { artifact: "compose.yaml", sha256: "a".repeat(64) },
    migration: {
      required: false,
      toDatabaseSchemaVersion: 12,
      backupRequired: true,
      rollbackSupported: false
    }
  });

  assert.equal(release.databaseSchemaVersion, 12);
  assert.equal(labWebSystemLabels.applicationId, "com.labwebsystem.application-id");

  assert.doesNotThrow(() => recoveryDescriptorSchema.parse({
    descriptorSchemaVersion: 1,
    applicationId: "app-1",
    repositoryPath: "/var/lib/labwebsystem/apps/app-1/repository",
    imageIdentifier: null,
    build: { composePath: "compose.yaml", composeProjectName: "lws-app-1", serviceName: "web" },
    runtime: {
      normalizedComposePath: "/var/lib/labwebsystem/apps/app-1/.lab-core/compose.yaml",
      composeEnvPath: null,
      publicServiceName: "web",
      publicPort: 8080,
      hostname: "app.example.test"
    },
    appdataPath: "/var/lib/labwebsystem/appdata/app-1",
    docker: { labels: {}, resources: { containers: [], networks: [], volumes: [] } },
    updatedAt: "2026-08-14T00:00:00.000Z"
  }));
});

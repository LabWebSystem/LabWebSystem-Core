import test from "node:test";
import assert from "node:assert/strict";
import {
  labWebSystemLabels,
  recoveryDescriptorSchema,
  releaseManifestSchema
} from "../src/index.js";

test("release manifest contains only Compose distribution metadata", () => {
  const release = releaseManifestSchema.parse({
    manifestVersion: 1,
    version: "0.8.0",
    minimumLwsctlVersion: "0.1.0",
    artifacts: { compose: { name: "compose.yaml", sha256: "a".repeat(64) } }
  });

  assert.equal(release.version, "0.8.0");
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

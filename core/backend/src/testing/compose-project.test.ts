import test from "node:test";
import assert from "node:assert/strict";
import {
  buildComposeProjectName,
  buildLegacyComposeProjectName,
  resolveComposeProjectName
} from "../services/compose-project.js";

test("buildComposeProjectName appends an id-based suffix for new deployments", () => {
  const projectName = buildComposeProjectName("app-XYZ_123", "Sample Camera App");

  assert.equal(projectName, "sample-camera-app-app-xyz");
});

test("resolveComposeProjectName keeps legacy names for existing deployments", () => {
  assert.equal(resolveComposeProjectName("app-1", "Sample Camera App", null), buildLegacyComposeProjectName("Sample Camera App"));
  assert.equal(resolveComposeProjectName("app-1", "Sample Camera App", "sample-camera-app-app1"), "sample-camera-app-app1");
});

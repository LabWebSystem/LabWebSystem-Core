import test from "node:test";
import assert from "node:assert/strict";
import {
  buildComposeProjectName,
  buildLegacyComposeProjectName,
  resolveComposeProjectName
} from "../services/compose-project.js";

test("buildComposeProjectName uses the application id as the project key", () => {
  const projectName = buildComposeProjectName("app-XYZ_123");

  assert.equal(projectName, "lws-app-xyz_123");
});

test("resolveComposeProjectName prefers stored names and otherwise derives from application id", () => {
  assert.equal(resolveComposeProjectName("app-1", "Sample Camera App", null), "lws-app-1");
  assert.equal(resolveComposeProjectName("app-1", "Sample Camera App", "sample-camera-app-app1"), "sample-camera-app-app1");
});

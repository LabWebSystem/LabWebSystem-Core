import assert from "node:assert/strict";
import test from "node:test";
import { getSecretValues, normalizeAppDataRootEnv } from "../modules/operations/application-runtime.js";

test("normalizes legacy APPDATA_ROOT values into sandboxed /data paths", () => {
  assert.equal(normalizeAppDataRootEnv("../../appdata/homepage-sample"), "/data/homepage-sample");
  assert.equal(normalizeAppDataRootEnv("./.appdata/homepage-sample"), "/data/homepage-sample");
  assert.equal(normalizeAppDataRootEnv("/home/example/runtime/appdata/homepage-sample"), "/data/homepage-sample");
  assert.equal(normalizeAppDataRootEnv("/data/postgres"), "/data/postgres");
  assert.equal(normalizeAppDataRootEnv(undefined), "/data");
});

test("getSecretValues redacts only sensitive env override values", () => {
  const values = getSecretValues({
    application_id: "app-1",
    name: "demo",
    repository_url: "https://example.com/repo.git",
    default_branch: "main",
    current_commit: null,
    previous_commit: null,
    compose_path: "docker-compose.yml",
    compose_project_name: "lws-app-1",
    public_service_name: "web",
    public_port: 8080,
    hostname: "demo.lab",
    mode: "standard",
    keep_volumes_on_rebuild: 1,
    env_overrides: JSON.stringify({
      APPDATA_ROOT: "./data",
      SECRET_TOKEN: "secret-value",
      LOG_LEVEL: "debug"
    }),
    enabled: 1
  });

  assert.deepEqual(values, ["secret-value"]);
});

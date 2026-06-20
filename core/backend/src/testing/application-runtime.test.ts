import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAppDataRootEnv } from "../modules/operations/application-runtime.js";

test("normalizes legacy APPDATA_ROOT values into sandboxed /data paths", () => {
  assert.equal(normalizeAppDataRootEnv("../../appdata/homepage-sample"), "/data/homepage-sample");
  assert.equal(normalizeAppDataRootEnv("./.appdata/homepage-sample"), "/data/homepage-sample");
  assert.equal(normalizeAppDataRootEnv("/home/example/runtime/appdata/homepage-sample"), "/data/homepage-sample");
  assert.equal(normalizeAppDataRootEnv("/data/postgres"), "/data/postgres");
  assert.equal(normalizeAppDataRootEnv(undefined), "/data");
});

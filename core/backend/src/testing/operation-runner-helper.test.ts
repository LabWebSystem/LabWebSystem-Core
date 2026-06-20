import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppRootDeleteHelperCommand } from "../modules/operations/operation-runner.js";

test("resolveAppRootDeleteHelperCommand returns a runnable helper command", () => {
  const command = resolveAppRootDeleteHelperCommand("app-delete", {
    useSudo: true,
    uid: 1000,
    pathValue: "/usr/bin:/bin",
    helperPath: "/tmp/delete-helper.mjs",
    nodePath: "/usr/local/bin/node",
    existsSync: (candidate) => candidate === "/usr/bin/sudo"
  });

  assert.equal(command.executable, "/usr/bin/sudo");
  assert.deepEqual(command.args, [
    "--non-interactive",
    "/usr/local/bin/node",
    "/tmp/delete-helper.mjs",
    "app-delete"
  ]);
});

test("resolveAppRootDeleteHelperCommand fails loudly when sudo is required but unavailable", () => {
  assert.throws(
    () => resolveAppRootDeleteHelperCommand("app-delete", {
      useSudo: true,
      uid: 1000,
      pathValue: "",
      existsSync: () => false
    }),
    /sudo が見つからない/
  );
});

test("resolveAppRootDeleteHelperCommand uses direct execution when sudo is disabled", () => {
  const command = resolveAppRootDeleteHelperCommand("app-delete", {
    useSudo: false,
    uid: 1000,
    helperPath: "/tmp/delete-helper.mjs",
    nodePath: "/usr/local/bin/node"
  });

  assert.equal(command.executable, "/usr/local/bin/node");
  assert.ok(command.args.includes("app-delete"));
});

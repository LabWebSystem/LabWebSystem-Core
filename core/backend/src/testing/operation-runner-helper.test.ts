import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppRootDeleteHelperCommand } from "../modules/operations/operation-runner.js";

test("resolveAppRootDeleteHelperCommand returns a runnable helper command", () => {
  const command = resolveAppRootDeleteHelperCommand("app-delete");

  assert.equal(typeof command.executable, "string");
  assert.ok(command.executable.length > 0);
  assert.ok(command.args.includes("app-delete"));
});

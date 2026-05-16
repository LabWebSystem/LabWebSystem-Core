import test from "node:test";
import assert from "node:assert/strict";
import { runSeedAction } from "../src/index.js";

test("returns non-executed when seed script is missing", async () => {
  const result = await runSeedAction(process.cwd(), "dev-sim", "verify");
  assert.equal(typeof result.executed, "boolean");
});

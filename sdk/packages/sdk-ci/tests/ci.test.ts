import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installGitHubActionsTemplate } from "../src/index.js";

test("installs ci template", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "labcore-ci-test-"));
  const result = installGitHubActionsTemplate(tempDir, true);
  assert.equal(result.written, true);
  assert.equal(fs.existsSync(result.path), true);
  const content = fs.readFileSync(result.path, "utf8");
  assert.match(content, /yarn exec labcore lint --profile dev-sim/);
  assert.match(content, /yarn exec labcore export --profile prod --out build\/labcore-payload\.json/);
});

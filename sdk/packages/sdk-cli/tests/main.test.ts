import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInitCommand } from "../src/commands/init.js";

test("init generates SDK guide under labcore directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "labcore-sdk-cli-init-"));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    const exitCode = runInitCommand(["--template", "standard", "--name", "demo-app"]);
    assert.equal(exitCode, 0);

    const guidePath = path.join(tempDir, "labcore", "SDK使い方.md");
    assert.equal(fs.existsSync(guidePath), true);

    const guide = fs.readFileSync(guidePath, "utf8");
    assert.match(guide, /labcore lint --profile dev-sim/);
    assert.match(guide, /yarn sdk:labcore lint --profile dev-sim/);
    assert.match(guide, /labcore\.app\.yaml/);
    assert.match(guide, /対象アプリ: `demo-app`/);
  } finally {
    process.chdir(previousCwd);
  }
});

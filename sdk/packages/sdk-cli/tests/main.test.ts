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
    const manifest = fs.readFileSync(path.join(tempDir, "labcore.app.yaml"), "utf8");
    const devProfile = fs.readFileSync(path.join(tempDir, "labcore", "profiles", "dev-real-device.yaml"), "utf8");
    const prodProfile = fs.readFileSync(path.join(tempDir, "labcore", "profiles", "prod.yaml"), "utf8");
    const packageJson = fs.readFileSync(path.join(tempDir, "package.json"), "utf8");

    assert.match(guide, /yarn exec labcore lint --profile dev-sim/);
    assert.match(guide, /yarn dlx -p @lab-core\/sdk-cli@https:\/\/github\.com\/LabWebSystem\/LabWebSystem-Core\.git#workspace=@lab-core\/sdk-cli&head=main labcore lint --profile dev-sim/);
    assert.match(guide, /yarn labcore:lint/);
    assert.match(guide, /labcore\.app\.yaml/);
    assert.match(guide, /対象アプリ: `demo-app`/);
    assert.match(manifest, /hostname: demo-app\.lab\.localhost/);
    assert.match(devProfile, /composeFiles:\n    - docker-compose\.yml\n    - docker-compose\.dev\.yml/);
    assert.match(prodProfile, /composeFiles:\n    - docker-compose\.yml/);
    assert.doesNotMatch(prodProfile, /docker-compose\.prod\.yml/);
    assert.match(packageJson, /"labcore:lint": "yarn exec labcore lint --profile dev-sim"/);
    assert.equal(fs.existsSync(path.join(tempDir, "docker-compose.prod.yml")), false);
  } finally {
    process.chdir(previousCwd);
  }
});

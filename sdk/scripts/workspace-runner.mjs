#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const action = process.argv[2];
if (!action) {
  console.error("usage: node scripts/workspace-runner.mjs <build|test|clean>");
  process.exit(2);
}

const packageOrder = [
  "@lab-core/sdk-contract",
  "@lab-core/sdk-inspect",
  "@lab-core/sdk-profile",
  "@lab-core/sdk-seed",
  "@lab-core/sdk-ci",
  "@lab-core/sdk",
  "@lab-core/sdk-cli"
];

for (const workspaceName of packageOrder) {
  console.log(`\n[workspace] ${workspaceName} -> ${action}`);
  const result = spawnSync("yarn", ["workspace", workspaceName, action], {
    stdio: "inherit",
    env: process.env
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

import { spawnSync } from "node:child_process";

type Action = "build" | "test" | "clean";

const actionArg = process.argv[2];
const allowedActions: Action[] = ["build", "test", "clean"];

if (!actionArg || !allowedActions.includes(actionArg as Action)) {
  console.error("usage: tsx scripts/workspace-runner.ts <build|test|clean>");
  process.exit(2);
}

const action = actionArg as Action;

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

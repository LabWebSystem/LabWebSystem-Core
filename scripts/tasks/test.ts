import { spawnSync } from "node:child_process";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

run("corepack", ["yarn", "workspace", "@lab-core/sdk-monorepo", "build"]);
run("corepack", ["yarn", "workspace", "@lab-core/sdk-monorepo", "test"]);
run("corepack", ["yarn", "workspace", "@lab-core/backend", "test"]);
run("corepack", ["yarn", "workspace", "@lab-core/dashboard", "build"]);

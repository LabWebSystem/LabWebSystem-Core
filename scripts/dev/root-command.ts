#!/usr/bin/env -S node --enable-source-maps

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { confirm } from "@inquirer/prompts";

type ComposeKey = "core" | "proxy" | "dns";
type CommandHandler = () => void | Promise<void>;

interface RunOptions {
  env?: NodeJS.ProcessEnv;
}

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const backendEnvPath = path.join(projectRoot, "core", "backend", ".env");

const composeFiles: Record<ComposeKey, string> = {
  core: "infra/compose/docker-compose.dev.yml",
  proxy: "infra/compose/docker-compose.proxy.yml",
  dns: "infra/compose/docker-compose.dns.yml"
};

const coreComposeEnv: NodeJS.ProcessEnv = {
  LAB_CORE_HOST_PROJECT_ROOT: projectRoot
};

const labEnv: NodeJS.ProcessEnv = {
  LAB_CORE_PROXY_HTTP_BIND: "0.0.0.0:80",
  LAB_CORE_DNS_BIND: "0.0.0.0:53"
};

function run(command: string, args: string[], options: RunOptions = {}): void {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) }
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.error) {
    throw result.error;
  }
}

function runTsScript(relativePath: string, args: string[] = [], options: RunOptions = {}): void {
  run("corepack", ["yarn", "tsx", relativePath, ...args], options);
}

function runCompose(composeKey: ComposeKey, args: string[], options: RunOptions = {}): void {
  run("docker", ["compose", "-f", composeFiles[composeKey], ...args], options);
}

function ensureGeneratedFiles(options: RunOptions = {}): void {
  runTsScript("scripts/dev/ensure-generated-files.ts", [], options);
}

function coreDeps(options: RunOptions = {}): void {
  runCompose("core", ["run", "--rm", "deps"], {
    env: { ...coreComposeEnv, ...(options.env ?? {}) }
  });
}

function coreUp(options: RunOptions = {}): void {
  ensureGeneratedFiles(options);
  coreDeps(options);
  runCompose("core", ["up", "-d", "backend", "dashboard"], {
    env: { ...coreComposeEnv, ...(options.env ?? {}) }
  });
}

function coreDown(options: RunOptions = {}): void {
  runCompose("core", ["down"], {
    env: { ...coreComposeEnv, ...(options.env ?? {}) }
  });
}

function proxyUp(options: RunOptions = {}): void {
  ensureGeneratedFiles(options);
  runCompose("proxy", ["up", "-d", "proxy"], options);
  runTsScript("scripts/dev/refresh-proxy-networks.ts", [], options);
}

function proxyDown(options: RunOptions = {}): void {
  runCompose("proxy", ["down"], options);
}

function dnsUp(options: RunOptions = {}): void {
  ensureGeneratedFiles(options);
  runCompose("dns", ["up", "-d", "dns"], options);
}

function dnsDown(options: RunOptions = {}): void {
  runCompose("dns", ["down"], options);
}

function kernelUp(options: RunOptions = {}): void {
  coreUp(options);
  proxyUp(options);
  dnsUp(options);
}

function kernelDown(options: RunOptions = {}): void {
  dnsDown(options);
  proxyDown(options);
  coreDown(options);
}

function runWithEnv(env: NodeJS.ProcessEnv, fn: () => void): void {
  const previousValues: Record<string, string | undefined> = {};
  const keys = Object.keys(env);
  for (const key of keys) {
    previousValues[key] = process.env[key];
    process.env[key] = env[key];
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      if (typeof previousValues[key] === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = previousValues[key];
      }
    }
  }
}

async function runConfigCommand(): Promise<void> {
  if (!fs.existsSync(backendEnvPath)) {
    runTsScript("scripts/config/env-wizard.ts", ["init"]);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("[config] core/backend/.env が存在するため、reset実行にはTTYが必要です。");
    console.error("[config] ターミナルで再実行してください。");
    process.exit(1);
  }

  const proceed = await confirm({
    message: "core/backend/.env が存在します。設定を再作成（reset）しますか？",
    default: false
  });

  if (!proceed) {
    console.log("[config] 中止しました。既存 .env は変更していません。");
    return;
  }

  runTsScript("scripts/config/env-wizard.ts", ["reset"], {
    env: { LAB_CORE_ENV_WIZARD_SKIP_EXISTING_CONFIRM: "1" }
  });
}

function ensureConfigFileExists(commandName: string): void {
  if (fs.existsSync(backendEnvPath)) {
    return;
  }

  console.error(`[${commandName}] core/backend/.env が見つかりません。`);
  console.error(`[${commandName}] 先に \`yarn config:set\` を実行してください。`);
  process.exit(1);
}

function runConfigShowCommand(): void {
  ensureConfigFileExists("config:show");

  if (!process.stdout.isTTY) {
    run("cat", [backendEnvPath]);
    return;
  }

  run(
    "bash",
    [
      "-lc",
      [
        "if [ -n \"${PAGER:-}\" ]; then",
        "  eval \"exec $PAGER \\\"\\$1\\\"\"",
        "fi",
        "if command -v less >/dev/null 2>&1; then",
        "  exec less -FRX \"$1\"",
        "fi",
        "if command -v more >/dev/null 2>&1; then",
        "  exec more \"$1\"",
        "fi",
        "exec cat \"$1\""
      ].join("\n"),
      "bash",
      backendEnvPath
    ]
  );
}

function runConfigEditCommand(): void {
  ensureConfigFileExists("config:edit");

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("[config:edit] エディタ起動にはTTYが必要です。");
    console.error("[config:edit] ターミナルで再実行してください。");
    process.exit(1);
  }

  run(
    "bash",
    [
      "-lc",
      [
        "if [ -n \"${VISUAL:-}\" ]; then",
        "  eval \"exec $VISUAL \\\"\\$1\\\"\"",
        "fi",
        "if [ -n \"${EDITOR:-}\" ]; then",
        "  eval \"exec $EDITOR \\\"\\$1\\\"\"",
        "fi",
        "if command -v vim >/dev/null 2>&1; then",
        "  exec vim \"$1\"",
        "fi",
        "if command -v vi >/dev/null 2>&1; then",
        "  exec vi \"$1\"",
        "fi",
        "if command -v nano >/dev/null 2>&1; then",
        "  exec nano \"$1\"",
        "fi",
        "echo \"[config:edit] 利用可能なエディタが見つかりません。VISUAL または EDITOR を設定してください。\" >&2",
        "exit 1"
      ].join("\n"),
      "bash",
      backendEnvPath
    ]
  );
}

const commands: Record<string, CommandHandler> = {
  "environment:dev:up": () => kernelUp(),
  "environment:dev:down": () => kernelDown(),
  "environment:dev:logs": () => runTsScript("scripts/dev/stream-kernel-logs.ts"),
  "environment:lab:up": () => runWithEnv(labEnv, () => kernelUp({ env: labEnv })),
  "environment:lab:down": () => runWithEnv(labEnv, () => kernelDown({ env: labEnv })),
  "environment:lab:logs": () => runTsScript("scripts/dev/stream-kernel-logs.ts"),
  "config:set": () => runConfigCommand(),
  "config:show": () => runConfigShowCommand(),
  "config:edit": () => runConfigEditCommand(),
  "service:backend:up": () => run("corepack", ["yarn", "workspace", "@lab-core/backend", "dev"]),
  "service:dashboard:up": () => run("corepack", ["yarn", "workspace", "@lab-core/dashboard", "dev"]),
  "quality:build": () => {
    run("corepack", ["yarn", "workspace", "@lab-core/backend", "build"]);
    run("corepack", ["yarn", "workspace", "@lab-core/dashboard", "build"]);
  },
  "quality:typecheck:scripts": () => run("corepack", ["yarn", "tsc", "-p", "tsconfig.scripts.json"]),
  "quality:test:fixtures": () => run("bash", ["scripts/testing/register_app_fixtures.sh"]),
  "quality:test:smoke": () => run("bash", ["scripts/testing/run_full_system_smoke_test.sh"]),
  destroy: () => runTsScript("scripts/maintenance/reset-lab-core.ts")
};

function printUsageAndExit(): never {
  const names = Object.keys(commands).sort((a, b) => a.localeCompare(b));

  console.error("Usage: yarn <command>");
  console.error("Available commands:");
  for (const name of names) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

const commandName = process.argv[2];
if (!commandName || !(commandName in commands)) {
  printUsageAndExit();
}

Promise.resolve()
  .then(() => commands[commandName]())
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[root-command] failed: ${message}`);
    process.exit(1);
  });

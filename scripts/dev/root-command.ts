#!/usr/bin/env -S node --enable-source-maps

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ComposeKey = "core" | "proxy" | "dns";
type CommandHandler = () => void | Promise<void>;

interface RunOptions {
  env?: NodeJS.ProcessEnv;
}

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const backendEnvPath = path.join(projectRoot, "core", "backend", ".env");
const dockerSocketPath = "/var/run/docker.sock";
const kernelNetworkName = "labcore-kernel";

function currentUid(): string {
  return typeof process.getuid === "function" ? String(process.getuid()) : "1000";
}

function currentGid(): string {
  return typeof process.getgid === "function" ? String(process.getgid()) : "1000";
}

function dockerSocketGroupId(): string {
  try {
    return String(fs.statSync(dockerSocketPath).gid);
  } catch {
    return currentGid();
  }
}

function parseEnvFile(content: string): NodeJS.ProcessEnv {
  const entries: NodeJS.ProcessEnv = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function readBackendEnv(): NodeJS.ProcessEnv {
  if (!fs.existsSync(backendEnvPath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(backendEnvPath, "utf8"));
}

function systemEnv(extraEnv: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...readBackendEnv(),
    ...process.env,
    ...extraEnv
  };
}

const composeFiles: Record<ComposeKey, string> = {
  core: "infra/compose/docker-compose.dev.yml",
  proxy: "infra/compose/docker-compose.proxy.yml",
  dns: "infra/compose/docker-compose.dns.yml"
};

const coreComposeEnv: NodeJS.ProcessEnv = {
  LAB_CORE_HOST_PROJECT_ROOT: projectRoot,
  LAB_CORE_HOST_UID: currentUid(),
  LAB_CORE_HOST_GID: currentGid(),
  LAB_CORE_DOCKER_SOCKET_GID: dockerSocketGroupId()
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

function ensureKernelNetwork(): void {
  const result = spawnSync("docker", ["network", "inspect", kernelNetworkName], {
    cwd: projectRoot,
    stdio: "ignore",
    env: process.env
  });

  if (result.status === 0) {
    return;
  }

  if (result.error) {
    throw result.error;
  }

  run("docker", ["network", "create", kernelNetworkName]);
}

function runCompose(composeKey: ComposeKey, args: string[], options: RunOptions = {}): void {
  run("docker", ["compose", "-f", composeFiles[composeKey], ...args], options);
}

function ensureGeneratedFiles(options: RunOptions = {}): void {
  runTsScript("scripts/dev/ensure-generated-files.ts", [], options);
}

function ensureManagedPermissions(options: RunOptions = {}): void {
  runTsScript("scripts/dev/ensure-managed-permissions.ts", [], options);
}

function coreDeps(options: RunOptions = {}): void {
  runCompose("core", ["run", "--rm", "deps"], {
    env: { ...coreComposeEnv, ...(options.env ?? {}) }
  });
}

function coreUp(options: RunOptions = {}): void {
  ensureManagedPermissions(options);
  ensureGeneratedFiles(options);
  coreDeps(options);
  ensureKernelNetwork();
  runCompose("core", ["up", "-d", "--force-recreate", "backend", "dashboard"], {
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
  ensureKernelNetwork();
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

  runTsScript("scripts/config/env-wizard.ts", ["reset"]);
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

function systemUp(): void {
  ensureConfigFileExists("system:up");
  const env = systemEnv();
  kernelUp({ env });
}

function systemDown(): void {
  const env = systemEnv();
  kernelDown({ env });
}

function systemLogs(): void {
  const env = systemEnv();
  runTsScript("scripts/dev/stream-kernel-logs.ts", [], { env });
}

function deprecatedEnvironmentCommand(oldName: string, newName: string, handler: CommandHandler): CommandHandler {
  return async () => {
    console.warn(`[deprecated] yarn ${oldName} は非推奨です。代わりに yarn ${newName} を使用してください。`);
    await handler();
  };
}

const commands: Record<string, CommandHandler> = {
  "system:up": () => systemUp(),
  "system:down": () => systemDown(),
  "system:logs": () => systemLogs(),
  "environment:dev:up": deprecatedEnvironmentCommand("environment:dev:up", "system:up", () => systemUp()),
  "environment:dev:down": deprecatedEnvironmentCommand("environment:dev:down", "system:down", () => systemDown()),
  "environment:dev:logs": deprecatedEnvironmentCommand("environment:dev:logs", "system:logs", () => systemLogs()),
  "environment:lab:up": deprecatedEnvironmentCommand("environment:lab:up", "system:up", () => systemUp()),
  "environment:lab:down": deprecatedEnvironmentCommand("environment:lab:down", "system:down", () => systemDown()),
  "environment:lab:logs": deprecatedEnvironmentCommand("environment:lab:logs", "system:logs", () => systemLogs()),
  "config:set": () => runConfigCommand(),
  "config:show": () => runConfigShowCommand(),
  "config:edit": () => runConfigEditCommand(),
  "permissions:repair": () => runTsScript("scripts/dev/repair-managed-permissions.ts"),
  "service:backend:up": () => {
    ensureManagedPermissions();
    run("corepack", ["yarn", "workspace", "@lab-core/backend", "dev"]);
  },
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

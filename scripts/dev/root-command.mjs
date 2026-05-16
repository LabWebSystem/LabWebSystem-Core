#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");

const composeFiles = {
  core: "infra/compose/docker-compose.dev.yml",
  proxy: "infra/compose/docker-compose.proxy.yml",
  dns: "infra/compose/docker-compose.dns.yml"
};

const labEnv = {
  LAB_CORE_PROXY_HTTP_BIND: "0.0.0.0:80",
  LAB_CORE_DNS_BIND: "0.0.0.0:53"
};

function run(command, args, options = {}) {
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

function runNodeScript(relativePath, args = [], options = {}) {
  run("node", [relativePath, ...args], options);
}

function runCompose(composeKey, args, options = {}) {
  run("docker", ["compose", "-f", composeFiles[composeKey], ...args], options);
}

function ensureGeneratedFiles(options = {}) {
  runNodeScript("scripts/dev/ensure-generated-files.mjs", [], options);
}

const commands = {
  dev: () => commands["dev:kernel:up"](),
  "dev:local": () => run("corepack", ["yarn", "workspace", "@lab-core/backend", "dev"]),
  "dev:backend": () => run("corepack", ["yarn", "workspace", "@lab-core/backend", "dev"]),
  "dev:dashboard": () => run("corepack", ["yarn", "workspace", "@lab-core/dashboard", "dev"]),
  "dev:core:deps": () =>
    runCompose("core", ["run", "--rm", "deps"], {
      env: { LAB_CORE_HOST_PROJECT_ROOT: projectRoot }
    }),
  "dev:core:up": () => {
    ensureGeneratedFiles();
    commands["dev:core:deps"]();
    runCompose("core", ["up", "-d", "backend", "dashboard"], {
      env: { LAB_CORE_HOST_PROJECT_ROOT: projectRoot }
    });
  },
  "dev:core:down": () =>
    runCompose("core", ["down"], {
      env: { LAB_CORE_HOST_PROJECT_ROOT: projectRoot }
    }),
  "dev:core:logs": () =>
    runCompose("core", ["logs", "-f", "backend", "dashboard"], {
      env: { LAB_CORE_HOST_PROJECT_ROOT: projectRoot }
    }),
  "dev:kernel:logs": () => runNodeScript("scripts/dev/stream-kernel-logs.mjs"),
  "dev:kernel:up": () => {
    commands["dev:core:up"]();
    commands["dev:proxy"]();
    commands["dev:dns"]();
  },
  "dev:kernel:down": () => {
    commands["dev:dns:down"]();
    commands["dev:proxy:down"]();
    commands["dev:core:down"]();
  },
  "lab:up": () => commands["dev:kernel:up:lab"](),
  "lab:down": () => commands["dev:kernel:down:lab"](),
  "lab:down-clean": () => {
    commands["lab:down"]();
    runNodeScript("scripts/maintenance/reset-lab-core.mjs", ["--yes"]);
  },
  "lab:logs": () => commands["dev:kernel:logs"](),
  "dev:lab": () => commands["lab:up"](),
  "dev:lab:down": () => commands["lab:down"](),
  "dev:lab:logs": () => commands["lab:logs"](),
  "dev:dns": () => {
    ensureGeneratedFiles();
    runCompose("dns", ["up", "-d", "dns"]);
  },
  "dev:dns:down": () => runCompose("dns", ["down"]),
  "dev:dns:logs": () => runCompose("dns", ["logs", "-f", "dns"]),
  "dev:proxy": () => {
    ensureGeneratedFiles();
    runCompose("proxy", ["up", "-d", "proxy"]);
    runNodeScript("scripts/dev/refresh-proxy-networks.mjs");
  },
  "dev:proxy:refresh": () => {
    ensureGeneratedFiles();
    runNodeScript("scripts/dev/refresh-proxy-networks.mjs");
    run("docker", ["restart", "labcore-dev-proxy-proxy-1"]);
  },
  "dev:proxy:down": () => runCompose("proxy", ["down"]),
  "dev:proxy:logs": () => runCompose("proxy", ["logs", "-f", "proxy"]),
  "permissions:repair": () => runNodeScript("scripts/dev/repair-managed-permissions.mjs"),
  "maintenance:reset": () => runNodeScript("scripts/maintenance/reset-lab-core.mjs"),
  "maintenance:reset:yes": () => runNodeScript("scripts/maintenance/reset-lab-core.mjs", ["--yes"]),
  build: () => {
    run("corepack", ["yarn", "workspace", "@lab-core/backend", "build"]);
    run("corepack", ["yarn", "workspace", "@lab-core/dashboard", "build"]);
  },
  "test:register-fixtures": () => run("bash", ["scripts/testing/register_app_fixtures.sh"]),
  "test:smoke": () => run("bash", ["scripts/testing/run_full_system_smoke_test.sh"]),
  "config:init": () => runNodeScript("scripts/config/env-wizard.mjs", ["init"]),
  "config:reset": () => runNodeScript("scripts/config/env-wizard.mjs", ["reset"]),
  "dev:kernel:up:lab": () => {
    runWithEnv(labEnv, () => commands["dev:kernel:up"]());
  },
  "dev:kernel:down:lab": () => {
    runWithEnv(labEnv, () => commands["dev:kernel:down"]());
  }
};

function runWithEnv(env, fn) {
  const prev = {};
  const keys = Object.keys(env);
  for (const key of keys) {
    prev[key] = process.env[key];
    process.env[key] = env[key];
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      if (typeof prev[key] === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = prev[key];
      }
    }
  }
}

function printUsageAndExit() {
  const names = Object.keys(commands)
    .filter((name) => !name.endsWith(":lab"))
    .sort((a, b) => a.localeCompare(b));
  console.error("Usage: node scripts/dev/root-command.mjs <command>");
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

try {
  commands[commandName]();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[root-command] failed: ${message}`);
  process.exit(1);
}

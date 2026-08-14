import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { productVersion } from "./version.js";

type Service = "backend" | "dashboard";
const root = process.cwd();
const stateDir = path.join(root, ".lab-core");
const pidFile = path.join(stateDir, "development.pids");

const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  LAB_CORE_VERSION: productVersion,
  LAB_CORE_EXECUTION_MODE: "dry-run",
  LAB_CORE_ROOT_DOMAIN: "lab.localhost",
  LAB_CORE_DNS_SERVER_ENABLED: "false",
  LAB_CORE_DATA_DIRECTORY: "./runtime/development",
  LAB_CORE_DB_PATH: "./runtime/development/database.sqlite",
  LAB_CORE_APPS_ROOT: "./runtime/development/apps",
  LAB_CORE_APPDATA_ROOT: "./runtime/development/appdata",
  LAB_CORE_SYNC_DIR: "./runtime/development/generated",
  LAB_CORE_PROXY_CONFIG_PATH: "./runtime/development/generated/Caddyfile",
  LAB_CORE_DNS_HOSTS_PATH: "./runtime/development/generated/hosts"
};

for (const directory of [
  "runtime/development",
  "runtime/development/apps",
  "runtime/development/appdata",
  "runtime/development/generated"
]) {
  fs.mkdirSync(path.join(root, directory), { recursive: true });
}

function commandFor(service: Service): { args: string[]; env: NodeJS.ProcessEnv } {
  if (service === "backend") {
    return {
      args: ["workspace", "@lab-core/backend", "dev"],
      env: baseEnv
    };
  }

  return {
    args: ["workspace", "@lab-core/dashboard", "dev"],
    env: { ...baseEnv, VITE_DEV_PROXY_TARGET: "http://127.0.0.1:7300" }
  };
}

function start(service: Service) {
  const command = commandFor(service);
  return spawn("yarn", command.args, {
    cwd: root,
    env: command.env,
    stdio: "inherit",
    detached: true
  });
}

const requested = process.argv[2] as "dev" | Service | undefined;
if (!requested || !["dev", "backend", "dashboard"].includes(requested)) {
  console.error("usage: mise run <dev|backend|dashboard>");
  process.exit(2);
}

const services: Service[] = requested === "dev" ? ["backend", "dashboard"] : [requested];
const children = services.map(start);
fs.writeFileSync(pidFile, `${children.map((child) => child.pid).filter(Boolean).join("\n")}\n`, "utf8");

let stopping = false;
function stop(signal: NodeJS.Signals = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid) {
      try { process.kill(-child.pid, signal); } catch { /* process already stopped */ }
    }
  }
  fs.rmSync(pidFile, { force: true });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

function waitForChildren(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    for (const child of children) {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (!stopping && code !== 0) {
          stop();
          reject(new Error(`${child.spawnargs.join(" ")} exited with code ${code}`));
        }
      });
    }
  });
}

waitForChildren()
  .then(() => fs.rmSync(pidFile, { force: true }))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

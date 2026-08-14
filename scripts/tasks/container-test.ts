import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { productVersion } from "./version.js";

const version = productVersion;
const backendImage = `labcore-test-backend:${version}`;
const dashboardImage = `labcore-test-dashboard:${version}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "labcore-container-test-"));
let containerId = "";

function run(args: string[]) {
  execFileSync("docker", args, { cwd: process.cwd(), stdio: "inherit", env: process.env });
}

function cleanup() {
  if (containerId) execFileSync("docker", ["rm", "-f", containerId], { stdio: "ignore" });
  fs.rmSync(dataDir, { recursive: true, force: true });
}

process.on("exit", cleanup);
run(["build", "-f", "infra/compose/Dockerfile.backend", "-t", backendImage, "."]);
run(["build", "-f", "infra/compose/Dockerfile.dashboard", "-t", dashboardImage, "."]);

containerId = execFileSync(
  "docker",
  [
    "run", "-d", "--rm", "-e", "LAB_CORE_VERSION=0.1.0", "-e", "LAB_CORE_EXECUTION_MODE=dry-run",
    "-e", "LAB_CORE_DNS_SERVER_ENABLED=false", "-e", "LAB_CORE_DATA_DIRECTORY=/var/lib/labcore",
    "-e", "LAB_CORE_DB_PATH=/var/lib/labcore/database.sqlite", "-e", "LAB_CORE_APPS_ROOT=/var/lib/labcore/apps",
    "-e", "LAB_CORE_APPDATA_ROOT=/var/lib/labcore/appdata", "-e", "LAB_CORE_SYNC_DIR=/var/lib/labcore/generated",
    "-v", `${dataDir}:/var/lib/labcore`, "-p", "127.0.0.1::7300", backendImage
  ],
  { encoding: "utf8" }
).trim();

const port = execFileSync("docker", ["port", containerId, "7300/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
if (!port) throw new Error("container port was not published");

for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    execFileSync("curl", ["-fsS", `http://127.0.0.1:${port}/health`], { stdio: "ignore" });
    console.log(`container verification passed: ${backendImage}, ${dashboardImage}`);
    process.exit(0);
  } catch {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}

throw new Error("container health check timed out");

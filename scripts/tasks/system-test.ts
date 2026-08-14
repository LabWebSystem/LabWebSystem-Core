import { execFileSync } from "node:child_process";
import { productVersion } from "./version.js";

const composeFile = "infra/compose/system-test.yaml";
const env = { ...process.env, LAB_CORE_SYSTEM_TEST_HTTP_PORT: process.env.LAB_CORE_SYSTEM_TEST_HTTP_PORT ?? "18080" };

function run(args: string[]) {
  execFileSync("docker", ["compose", "-f", composeFile, ...args], { cwd: process.cwd(), stdio: "inherit", env });
}

function cleanup() {
  try {
    run(["down", "--volumes", "--remove-orphans"]);
  } catch {
    // Preserve the test failure while still attempting cleanup.
  }
}

process.on("exit", cleanup);
execFileSync("docker", ["build", "-f", "infra/compose/Dockerfile.backend", "-t", `labcore-system-test-backend:${productVersion}`, "."], { cwd: process.cwd(), stdio: "inherit", env });
execFileSync("docker", ["build", "-f", "infra/compose/Dockerfile.dashboard", "-t", `labcore-system-test-dashboard:${productVersion}`, "."], { cwd: process.cwd(), stdio: "inherit", env });
run(["up", "-d"]);

const port = env.LAB_CORE_SYSTEM_TEST_HTTP_PORT;
for (let attempt = 0; attempt < 45; attempt += 1) {
  try {
    execFileSync("curl", ["-fsS", `http://127.0.0.1:${port}/health`], { stdio: "ignore" });
    execFileSync("curl", ["-fsS", `http://127.0.0.1:${port}/api`], { stdio: "ignore" });
    execFileSync("curl", ["-fsS", `http://127.0.0.1:${port}/`], { stdio: "ignore" });
    console.log("system verification passed: DNS / proxy / dashboard / backend containers are reachable");
    process.exit(0);
  } catch {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}

throw new Error("system verification health check timed out");

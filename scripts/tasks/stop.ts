import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pidFile = path.join(root, ".lab-core", "development.pids");
if (fs.existsSync(pidFile)) {
  for (const line of fs.readFileSync(pidFile, "utf8").split(/\r?\n/)) {
    const pid = Number(line);
    if (Number.isInteger(pid) && pid > 1) {
      try { process.kill(-pid, "SIGTERM"); } catch { /* process already stopped */ }
    }
  }
  fs.rmSync(pidFile, { force: true });
}

try {
  execFileSync("docker", ["compose", "-f", "infra/compose/system-test.yaml", "down", "--volumes", "--remove-orphans"], { stdio: "inherit" });
} catch {
  // No system-test environment is a valid stopped state.
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
for (const target of ["runtime/development", ".lab-core/development.pids"]) {
  fs.rmSync(path.join(root, target), { recursive: true, force: true });
}
console.log("development artifacts cleaned");

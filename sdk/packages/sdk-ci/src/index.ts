import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function installGitHubActionsTemplate(cwd: string, force = false): { written: boolean; path: string } {
  const templatePath = path.resolve(__dirname, "..", "..", "templates", "github-actions-labcore.yml");
  const outputPath = path.resolve(cwd, ".github", "workflows", "labcore-sdk.yml");

  if (fs.existsSync(outputPath) && !force) {
    return { written: false, path: outputPath };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(templatePath, outputPath);
  return { written: true, path: outputPath };
}

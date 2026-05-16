import fs from "node:fs";
import path from "node:path";
import { hasFlag, readOption } from "../shared/args.js";
import { loadContext } from "../shared/context.js";
import { runCommand } from "../shared/command-runner.js";
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_VALIDATION } from "../shared/error-codes.js";

function normalizeProjectName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  return normalized.length > 0 ? normalized : "labcore-app";
}

function composeBaseArgs(projectName: string, composeFiles: string[], envFilePath: string | null): string[] {
  const args = ["compose", "-p", projectName];
  for (const file of composeFiles) {
    args.push("-f", file);
  }
  if (envFilePath) {
    args.push("--env-file", envFilePath);
  }
  return args;
}

function quoteEnvValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"').replace(/\$/g, "$$$$")}"`;
}

function writeEnvFile(cwd: string, envOverrides: Record<string, string>): string | null {
  const entries = Object.entries(envOverrides).filter(([, value]) => value.trim().length > 0);
  if (entries.length === 0) {
    return null;
  }

  const runtimeDir = path.resolve(cwd, ".labcore", "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  const envFilePath = path.resolve(runtimeDir, ".compose.env");

  const body = entries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`)
    .join("\n");

  fs.writeFileSync(envFilePath, `${body}\n`, "utf8");
  return envFilePath;
}

export async function runPreflightCommand(args: string[]): Promise<number> {
  const profile = readOption(args, "profile");
  const tail = Number(readOption(args, "tail") ?? "200");
  const keepUp = hasFlag(args, "keep-up");

  try {
    const context = loadContext(process.cwd(), profile);
    const composePaths = context.resolved.composeFiles.length > 0
      ? context.resolved.composeFiles
      : [context.resolved.manifest.deployment.composePath];

    for (const composePath of composePaths) {
      const absolutePath = path.resolve(context.cwd, composePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`compose file not found: ${composePath}`);
      }
    }

    const projectName = normalizeProjectName(context.resolved.manifest.app.name);
    const envFilePath = writeEnvFile(context.cwd, context.resolved.envOverrides);
    const baseArgs = composeBaseArgs(projectName, composePaths, envFilePath);
    const serviceName = context.resolved.manifest.exposure.service;

    const runStep = async (stepName: string, extraArgs: string[]): Promise<void> => {
      process.stdout.write(`\n[preflight] ${stepName}\n`);
      const result = await runCommand("docker", [...baseArgs, ...extraArgs], context.cwd);
      if (result.exitCode !== 0) {
        throw new Error(`preflight failed at ${stepName}`);
      }
    };

    let upSucceeded = false;

    try {
      await runStep("config --services", ["config", "--services"]);
      await runStep("up", ["up", "-d", "--build", "--remove-orphans"]);
      upSucceeded = true;
      await runStep("restart", ["restart", serviceName]);
      await runStep("logs", ["logs", "--no-color", "--tail", String(Number.isFinite(tail) ? tail : 200), serviceName]);
    } finally {
      if (upSucceeded && !keepUp) {
        await runStep("down", ["down", "--remove-orphans"]);
      }
    }

    return EXIT_SUCCESS;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_VALIDATION;
  }
}

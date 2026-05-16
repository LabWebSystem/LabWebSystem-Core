import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export type SeedAction = "apply" | "verify" | "reset";

export type SeedResult = {
  action: SeedAction;
  executed: boolean;
  scriptPath: string | null;
  exitCode: number;
  stdout: string;
  stderr: string;
  message: string;
};

function candidateScripts(cwd: string, action: SeedAction): string[] {
  return [
    path.resolve(cwd, "labcore", "seeds", `${action}.sh`),
    path.resolve(cwd, "labcore", "seeds", `${action}.js`)
  ];
}

function findScript(cwd: string, action: SeedAction): string | null {
  return candidateScripts(cwd, action).find((candidate) => fs.existsSync(candidate)) ?? null;
}

async function runProcess(command: string, args: string[], cwd: string, env: Record<string, string>): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr
      });
    });
  });
}

function resolveScriptRunner(scriptPath: string): { command: string; args: string[] } {
  if (scriptPath.endsWith(".js")) {
    return { command: "node", args: [scriptPath] };
  }
  return { command: "bash", args: [scriptPath] };
}

export async function runSeedAction(cwd: string, profileName: string, action: SeedAction): Promise<SeedResult> {
  const scriptPath = findScript(cwd, action);
  if (!scriptPath) {
    return {
      action,
      executed: false,
      scriptPath: null,
      exitCode: 0,
      stdout: "",
      stderr: "",
      message: `seed script not found: labcore/seeds/${action}.sh`
    };
  }

  const { command, args } = resolveScriptRunner(scriptPath);
  const result = await runProcess(command, args, cwd, {
    LABCORE_PROFILE: profileName,
    LABCORE_SEED_ACTION: action
  });

  return {
    action,
    executed: true,
    scriptPath,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    message: result.exitCode === 0 ? `seed ${action} succeeded` : `seed ${action} failed`
  };
}

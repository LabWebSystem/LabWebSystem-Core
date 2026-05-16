import { spawn } from "node:child_process";

export type CommandResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runCommand(command: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<CommandResult> {
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
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (error) => reject(error));
    child.on("close", (exitCode) => {
      resolve({
        command: [command, ...args].join(" "),
        stdout,
        stderr,
        exitCode: exitCode ?? 1
      });
    });
  });
}

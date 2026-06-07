import { lintSdk } from "@lab-core/sdk";
import { spawnSync } from "node:child_process";
import { readOption } from "../shared/args.js";
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_VALIDATION } from "../shared/error-codes.js";
import { printList, printSection } from "../presenters/human.js";

function checkBinary(name: string): { ok: boolean; detail: string } {
  const result = spawnSync(name, ["--version"], {
    stdio: "pipe"
  });

  if (result.error) {
    return { ok: false, detail: result.error.message };
  }

  if ((result.status ?? 1) !== 0) {
    return { ok: false, detail: (result.stderr?.toString() ?? "unknown error").trim() };
  }

  const stdout = (result.stdout?.toString() ?? "").trim();
  return { ok: true, detail: stdout.split("\n")[0] ?? "ok" };
}

export function runDoctorCommand(args: string[]): number {
  const profile = readOption(args, "profile");

  try {
    const docker = checkBinary("docker");
    const git = checkBinary("git");
    const lint = lintSdk({ cwd: process.cwd(), profile });

    printSection("doctor");
    process.stdout.write(`docker: ${docker.ok ? "ok" : "ng"} (${docker.detail})\n`);
    process.stdout.write(`git: ${git.ok ? "ok" : "ng"} (${git.detail})\n`);
    process.stdout.write(`lint: ${lint.ok ? "ok" : "ng"}\n`);

    if (lint.errors.length > 0) {
      printSection("lint errors");
      printList(lint.errors);
    }

    if (lint.warnings.length > 0) {
      printSection("lint warnings");
      printList(lint.warnings);
    }

    if (!docker.ok || !git.ok) {
      return EXIT_FAILURE;
    }

    return lint.ok ? EXIT_SUCCESS : EXIT_VALIDATION;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}

import { runInitCommand } from "./commands/init.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runLintCommand } from "./commands/lint.js";
import { runExportCommand } from "./commands/export.js";
import { runGuardCommand } from "./commands/guard.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runSeedCommand } from "./commands/seed.js";
import { runPreflightCommand } from "./commands/preflight.js";
import { runCiInstallCommand } from "./commands/ci-install.js";
import { EXIT_USAGE } from "./shared/error-codes.js";

function usage(): string {
  return [
    "Lab-Core SDK v0.1.0",
    "",
    "Usage:",
    "  labcore init [--template standard|headless|device] [--existing] [--force] [--name <appName>]",
    "  labcore inspect [--profile <name>] [--format human|json]",
    "  labcore lint [--profile <name>] [--format human|json]",
    "  labcore preflight [--profile <name>] [--tail <n>] [--keep-up]",
    "  labcore seed <apply|verify|reset> [--profile <name>]",
    "  labcore export [--profile <name>] [--out <path>]",
    "  labcore guard prod [--profile prod]",
    "  labcore doctor [--profile <name>]",
    "  labcore ci-install [--force]",
    ""
  ].join("\n");
}

export async function main(args: string[]): Promise<void> {
  const command = args[0];

  if (!command || command === "-h" || command === "--help" || command === "help") {
    process.stdout.write(usage());
    process.exitCode = 0;
    return;
  }

  const rest = args.slice(1);

  switch (command) {
    case "init":
      process.exitCode = runInitCommand(rest);
      return;
    case "inspect":
      process.exitCode = runInspectCommand(rest);
      return;
    case "lint":
      process.exitCode = runLintCommand(rest);
      return;
    case "preflight":
      process.exitCode = await runPreflightCommand(rest);
      return;
    case "seed":
      process.exitCode = await runSeedCommand(rest);
      return;
    case "export":
      process.exitCode = runExportCommand(rest);
      return;
    case "guard":
      process.exitCode = runGuardCommand(rest);
      return;
    case "doctor":
      process.exitCode = runDoctorCommand(rest);
      return;
    case "ci-install":
      process.exitCode = runCiInstallCommand(rest);
      return;
    default:
      process.stderr.write(`unknown command: ${command}\n\n`);
      process.stderr.write(usage());
      process.exitCode = EXIT_USAGE;
  }
}

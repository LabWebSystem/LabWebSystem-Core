import { execFileSync, spawnSync } from "node:child_process";
import readline from "node:readline/promises";

const VERSION_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+$/;

function usage(): void {
  console.log("使い方: mise run deploy --version vX.Y.Z");
}

function usageText(): string {
  return "使い方: mise run deploy --version vX.Y.Z";
}

function fail(message: string, exitCode = 1): never {
  console.error(message);
  process.exit(exitCode);
}

function commandExists(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function commandSucceeds(command: string, args: string[]): boolean {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function capture(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8", env: process.env }).trim();
}

async function confirmReplacement(version: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(`タグまたはRelease ${version} はすでに存在します。TTYで再実行して削除確認を行ってください。`);
    return false;
  }

  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`タグまたはRelease ${version} はすでに存在します。削除して再デプロイしますか？ [y/N] `);
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    prompt.close();
  }
}

function parseVersion(args: string[]): string {
  let version = process.env.usage_version ?? "";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--version") {
      if (!args[index + 1]) fail("--version は必須値です。", 2);
      version = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    fail(`不明な引数です: ${arg}\n${usageText()}`, 2);
  }

  if (!version) fail(`--version は必須です。\n${usageText()}`, 2);
  if (!VERSION_PATTERN.test(version)) fail(`バージョンはvX.Y.Z形式で指定してください: ${version}`, 2);
  return version;
}

async function main(): Promise<void> {
  const version = parseVersion(process.argv.slice(2));

  if (!commandExists("git")) fail("gitが必要です。");
  if (!commandExists("gh")) fail("GitHub CLI (gh)が必要です。");
  if (!commandSucceeds("gh", ["auth", "status"])) fail("デプロイ前にgh auth loginを実行してください。");
  if (capture("git", ["status", "--porcelain"]).length > 0) {
    fail("デプロイ前にコミットしてください。作業ツリーに未コミットの変更があります。");
  }

  const localTagExists = commandSucceeds("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${version}`]);
  const remoteTagExists = commandSucceeds("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${version}`]);
  const releaseExists = commandSucceeds("gh", ["release", "view", version]);

  if (localTagExists || remoteTagExists || releaseExists) {
    if (!(await confirmReplacement(version))) {
      console.log("デプロイを中止しました。");
      process.exit(1);
    }

    if (releaseExists) {
      run("gh", ["release", "delete", version, "--yes", "--cleanup-tag"]);
    } else if (remoteTagExists) {
      run("git", ["push", "origin", `:refs/tags/${version}`]);
    }

    if (localTagExists) run("git", ["tag", "-d", version]);
  }

  run("git", ["tag", "-a", version, "-m", `Release ${version}`]);
  run("git", ["push", "origin", version]);
  console.log(`${version} のデプロイを開始しました。GitHub ActionsがReleaseをビルドして公開します。`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));

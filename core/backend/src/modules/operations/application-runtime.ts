import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { simpleGit } from "simple-git";
import { env } from "../../lib/env.js";
import { runCommand } from "../../services/command-runner.js";
import { chooseRecommendedComposeService, inspectComposeYaml } from "../../services/compose-inspection.js";
import { resolveComposeProjectName } from "../../services/compose-project.js";

export type RuntimeApplicationTarget = {
  application_id: string;
  name: string;
  repository_url: string;
  default_branch: string;
  current_commit: string | null;
  previous_commit: string | null;
  compose_path: string;
  compose_project_name: string | null;
  public_service_name: string;
  public_port: number;
  hostname: string;
  mode: string;
  keep_volumes_on_rebuild: number;
  env_overrides: string;
  enabled: number;
};

export function getRuntimeApplicationTarget(db: Database.Database, applicationId: string): RuntimeApplicationTarget {
  const row = db
    .prepare(
      `
        SELECT
          a.application_id,
          a.name,
          a.repository_url,
          a.default_branch,
          a.current_commit,
          a.previous_commit,
          d.compose_path,
          d.compose_project_name,
          d.public_service_name,
          d.public_port,
          d.hostname,
          d.mode,
          d.keep_volumes_on_rebuild,
          d.env_overrides,
          d.enabled
        FROM applications a
        INNER JOIN deployments d ON d.application_id = a.application_id
        WHERE a.application_id = ?
          AND a.deleted_at IS NULL
      `
    )
    .get(applicationId) as RuntimeApplicationTarget | undefined;

  if (!row) {
    throw new Error("Application not found.");
  }

  return row;
}

export function getRepositoryPath(applicationName: string): string {
  return path.join(env.appsRoot, applicationName);
}

export function getAppDataPath(applicationName: string): string {
  return path.join(env.appDataRoot, applicationName);
}

export function setApplicationStatus(
  db: Database.Database,
  applicationId: string,
  status: string,
  updatedAt: string
): void {
  db.prepare(
    `
      UPDATE applications
      SET status = ?, updated_at = ?
      WHERE application_id = ?
    `
  ).run(status, updatedAt, applicationId);
}

export function markApplicationDeleted(db: Database.Database, applicationId: string, timestamp: string): void {
  db.prepare(
    `
      UPDATE applications
      SET status = 'Deleted',
          deleted_at = ?,
          updated_at = ?
      WHERE application_id = ?
    `
  ).run(timestamp, timestamp, applicationId);

  db.prepare(
    `
      UPDATE deployments
      SET released_at = ?
      WHERE application_id = ?
    `
  ).run(timestamp, applicationId);

  db.prepare(
    `
      UPDATE routes
      SET enabled = 0,
          released_at = ?
      WHERE application_id = ?
    `
  ).run(timestamp, applicationId);
}

export function setDeploymentEnabled(db: Database.Database, applicationId: string, enabled: boolean): void {
  db.prepare("UPDATE deployments SET enabled = ? WHERE application_id = ?").run(enabled ? 1 : 0, applicationId);
  db.prepare("UPDATE routes SET enabled = ? WHERE application_id = ?").run(enabled ? 1 : 0, applicationId);
}

function parseEnvOverrides(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
        .map(([key, entryValue]) => [key, entryValue])
    );
  } catch {
    return {};
  }
}

export function getSecretValues(target: RuntimeApplicationTarget): string[] {
  return Object.values(parseEnvOverrides(target.env_overrides)).filter((value) => value.trim().length > 0);
}

function quoteEnvFileValue(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\$/g, "$$$$")
    .replace(/"/g, '\\"')}"`;
}

export function writeComposeEnvFile(target: RuntimeApplicationTarget): string | null {
  const envOverrides = parseEnvOverrides(target.env_overrides);
  const entries = Object.entries(envOverrides).filter(([, value]) => value.trim().length > 0);
  if (entries.length === 0) {
    return null;
  }

  const appDataPath = getAppDataPath(target.name);
  fs.mkdirSync(appDataPath, { recursive: true });

  const envFilePath = path.join(appDataPath, ".lab-core.compose.env");
  const lines = entries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${quoteEnvFileValue(value)}`);

  fs.writeFileSync(envFilePath, `${lines.join("\n")}\n`, "utf8");
  return envFilePath;
}

function buildComposeArgs(
  composeFilePath: string,
  composeProjectName: string,
  subcommandArgs: string[],
  envFilePath: string | null
): string[] {
  const args = ["compose", "-p", composeProjectName, "-f", composeFilePath];
  if (envFilePath) {
    args.push("--env-file", envFilePath);
  }
  args.push(...subcommandArgs);
  return args;
}

function dryRunCommit(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export async function ensureRepository(
  target: RuntimeApplicationTarget,
  executionMode: "dry-run" | "execute" = env.executionMode
): Promise<{ repoPath: string; headCommit: string }> {
  const repoPath = getRepositoryPath(target.name);
  const repoExists = fs.existsSync(path.join(repoPath, ".git"));

  if (executionMode === "dry-run") {
    return {
      repoPath,
      headCommit: dryRunCommit("dry-run")
    };
  }

  fs.mkdirSync(env.appsRoot, { recursive: true });
  fs.mkdirSync(env.appDataRoot, { recursive: true });

  if (!repoExists) {
    await simpleGit(env.appsRoot).clone(target.repository_url, target.name, ["--branch", target.default_branch, "--single-branch"]);
  } else {
    const git = simpleGit(repoPath);
    await git.fetch();
    await git.checkout(target.default_branch);
    await git.pull("origin", target.default_branch);
  }

  const git = simpleGit(repoPath);
  const headCommit = (await git.revparse(["HEAD"])).trim();
  return { repoPath, headCommit };
}

export function resolveProjectName(target: RuntimeApplicationTarget): string {
  return resolveComposeProjectName(target.application_id, target.name, target.compose_project_name);
}

export async function runComposeUp(
  repoPath: string,
  composeFilePath: string,
  composeProjectName: string,
  envFilePath: string | null
): Promise<void> {
  await runCommand("docker", buildComposeArgs(composeFilePath, composeProjectName, ["up", "-d", "--build", "--remove-orphans"], envFilePath), {
    cwd: repoPath
  });
}

export async function runComposeRestart(
  repoPath: string,
  composeFilePath: string,
  composeProjectName: string,
  envFilePath: string | null
): Promise<void> {
  await runCommand("docker", buildComposeArgs(composeFilePath, composeProjectName, ["restart"], envFilePath), { cwd: repoPath });
}

export async function runComposeStop(
  repoPath: string,
  composeFilePath: string,
  composeProjectName: string,
  envFilePath: string | null
): Promise<void> {
  await runCommand("docker", buildComposeArgs(composeFilePath, composeProjectName, ["stop"], envFilePath), { cwd: repoPath });
}

export async function runComposeDown(
  repoPath: string,
  composeFilePath: string,
  composeProjectName: string,
  envFilePath: string | null,
  keepData: boolean
): Promise<void> {
  const args = buildComposeArgs(composeFilePath, composeProjectName, ["down"], envFilePath);
  args.push("--remove-orphans");
  if (!keepData) {
    args.push("-v");
  }
  await runCommand("docker", args, { cwd: repoPath });
}

export async function runComposeDownByProject(composeProjectName: string, keepData: boolean): Promise<void> {
  const args = ["compose", "-p", composeProjectName, "down", "--remove-orphans"];
  if (!keepData) {
    args.push("-v");
  }
  await runCommand("docker", args);
}

export function setCommitInfo(db: Database.Database, applicationId: string, commitHash: string, updatedAt: string): void {
  db.prepare(
    `
      UPDATE applications
      SET previous_commit = current_commit,
          current_commit = ?,
          updated_at = ?
      WHERE application_id = ?
    `
  ).run(commitHash, updatedAt, applicationId);

  db.prepare(
    `
      INSERT INTO update_info (
        application_id,
        current_commit,
        latest_remote_commit,
        has_update,
        checked_at
      ) VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(application_id) DO UPDATE SET
        current_commit = excluded.current_commit,
        latest_remote_commit = excluded.latest_remote_commit,
        has_update = 0,
        checked_at = excluded.checked_at
    `
  ).run(applicationId, commitHash, commitHash, updatedAt);
}

export function upsertUpdateInfo(
  db: Database.Database,
  applicationId: string,
  currentCommit: string,
  latestRemoteCommit: string,
  hasUpdate: boolean,
  updatedAt: string
): void {
  db.prepare(
    `
      INSERT INTO update_info (
        application_id,
        current_commit,
        latest_remote_commit,
        has_update,
        checked_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(application_id) DO UPDATE SET
        current_commit = excluded.current_commit,
        latest_remote_commit = excluded.latest_remote_commit,
        has_update = excluded.has_update,
        checked_at = excluded.checked_at
    `
  ).run(applicationId, currentCommit, latestRemoteCommit, hasUpdate ? 1 : 0, updatedAt);
}

export function getCommitInfo(db: Database.Database, applicationId: string): { currentCommit: string | null; previousCommit: string | null } {
  const row = db
    .prepare(
      `
        SELECT current_commit, previous_commit
        FROM applications
        WHERE application_id = ?
      `
    )
    .get(applicationId) as { current_commit: string | null; previous_commit: string | null } | undefined;

  if (!row) {
    throw new Error("Application not found.");
  }

  return {
    currentCommit: row.current_commit,
    previousCommit: row.previous_commit
  };
}

export function setCommitPair(
  db: Database.Database,
  applicationId: string,
  currentCommit: string,
  previousCommit: string | null,
  updatedAt: string
): void {
  db.prepare(
    `
      UPDATE applications
      SET current_commit = ?,
          previous_commit = ?,
          updated_at = ?
      WHERE application_id = ?
    `
  ).run(currentCommit, previousCommit, updatedAt, applicationId);
}

export function reconcileDeploymentRouting(
  db: Database.Database,
  applicationId: string,
  composeFilePath: string,
  configuredServiceName: string,
  configuredPort: number,
  executionMode: "dry-run" | "execute" = env.executionMode
): { serviceName: string; port: number; corrected: boolean; reason: string } {
  if (executionMode === "dry-run") {
    return {
      serviceName: configuredServiceName,
      port: configuredPort,
      corrected: false,
      reason: "dry-run では compose 実体補正を行いません。"
    };
  }

  if (!fs.existsSync(composeFilePath)) {
    return {
      serviceName: configuredServiceName,
      port: configuredPort,
      corrected: false,
      reason: "compose ファイルが見つからないため現在設定を維持しました。"
    };
  }

  const content = fs.readFileSync(composeFilePath, "utf8");
  const inspection = inspectComposeYaml({
    rawYaml: content,
    selectedComposePath: path.basename(composeFilePath),
    source: {
      kind: "local",
      path: path.basename(composeFilePath),
      absolutePath: composeFilePath
    }
  });

  if (inspection.parseError) {
    return {
      serviceName: configuredServiceName,
      port: configuredPort,
      corrected: false,
      reason: `compose の YAML 解析に失敗したため現在設定を維持しました。${inspection.parseError}`
    };
  }

  const configuredService = inspection.services.find((service) => service.name === configuredServiceName);
  let resolvedServiceName = configuredServiceName;
  let resolvedPort = configuredPort;

  if (!configuredService) {
    const recommended = chooseRecommendedComposeService(inspection.services);
    if (recommended) {
      resolvedServiceName = recommended.name;
      resolvedPort = recommended.detectedPublicPort ?? recommended.portOptions[0] ?? configuredPort;
    }
  } else if (!configuredService.portOptions.includes(configuredPort)) {
    resolvedPort = configuredService.detectedPublicPort ?? configuredService.portOptions[0] ?? configuredPort;
  }

  const corrected = resolvedServiceName !== configuredServiceName || resolvedPort !== configuredPort;
  if (corrected) {
    db.prepare(
      `
        UPDATE deployments
        SET public_service_name = ?, public_port = ?
        WHERE application_id = ?
      `
    ).run(resolvedServiceName, resolvedPort, applicationId);
    db.prepare(
      `
        UPDATE routes
        SET upstream_container = ?, upstream_port = ?
        WHERE application_id = ?
      `
    ).run(resolvedServiceName, resolvedPort, applicationId);
  }

  return {
    serviceName: resolvedServiceName,
    port: resolvedPort,
    corrected,
    reason: corrected
      ? `compose 実体に合わせて公開先を ${resolvedServiceName}:${resolvedPort} に補正しました。`
      : "compose 実体と公開設定は一致していました。"
  };
}

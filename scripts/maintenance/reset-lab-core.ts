#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { input } from "@inquirer/prompts";

export type DestroyMode = "soft" | "hard";

type DockerContainerInfo = {
  id: string;
  name: string;
  project: string;
  service: string;
  workingDir: string;
};

type DockerNetworkInfo = {
  name: string;
  project: string;
  network: string;
};

type DockerVolumeInfo = {
  name: string;
  project: string;
  volume: string;
};

export type ResetConfig = {
  rootDir: string;
  envPath: string;
  infraComposeDir: string;
  dbPath: string;
  generatedSyncDir: string;
  appsRoot: string;
  appDataRoot: string;
  kernelNetworkName: string;
};

type ComposeConfigSummary = {
  file: string;
  projectName: string;
  networkNames: string[];
  volumeNames: string[];
};

export type ResetInventory = {
  mode: DestroyMode;
  config: ResetConfig;
  mainComposeConfigs: ComposeConfigSummary[];
  runtimeProjects: string[];
  containers: DockerContainerInfo[];
  networkNames: string[];
  volumeNames: string[];
  generatedArtifacts: string[];
  dbArtifacts: string[];
  backupPaths: string[];
};

export type ResetPlan = {
  mode: DestroyMode;
  config: ResetConfig;
  composeFiles: string[];
  runtimeProjects: string[];
  deleteContainerIds: string[];
  deleteContainerNames: string[];
  deleteNetworkNames: string[];
  deleteGeneratedArtifacts: string[];
  deleteDbArtifacts: string[];
  deleteRuntimeRoots: string[];
  deleteVolumeNames: string[];
  deleteBackupPaths: string[];
  keepDbArtifacts: string[];
  keepRuntimeRoots: string[];
  keepVolumeNames: string[];
  keepBackupPaths: string[];
  keepActiveEnvPaths: string[];
  keepGitWorktreePaths: string[];
};

export type ResetExecutor = {
  composeDown(composeFile: string, removeVolumes: boolean): void;
  composeDownByProject(projectName: string, removeVolumes: boolean): void;
  removeContainers(containerIds: string[]): void;
  removeNetworks(networkNames: string[]): void;
  removeVolumes(volumeNames: string[]): void;
  clearDirectoryContents(directoryPath: string): Promise<void>;
  removeFileIfExists(filePath: string): Promise<void>;
};

type ParseArgsResult = {
  mode: DestroyMode;
};

const thisFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(thisFile), "..", "..");
const envPath = path.join(rootDir, "core", "backend", ".env");
const currentUid = typeof process.getuid === "function" ? process.getuid() : 1000;
const currentGid = typeof process.getgid === "function" ? process.getgid() : 1000;
const kernelNetworkName = "labcore-kernel";
const composeFiles = [
  "infra/compose/docker-compose.dev.yml",
  "infra/compose/docker-compose.proxy.yml",
  "infra/compose/docker-compose.dns.yml"
] as const;
const mainComposeFallbacks: Record<(typeof composeFiles)[number], Omit<ComposeConfigSummary, "file">> = {
  "infra/compose/docker-compose.dev.yml": {
    projectName: "compose",
    networkNames: ["compose_default", kernelNetworkName],
    volumeNames: ["compose_labcore_node_modules"]
  },
  "infra/compose/docker-compose.proxy.yml": {
    projectName: "labcore-dev-proxy",
    networkNames: ["labcore-dev-proxy_default", kernelNetworkName],
    volumeNames: []
  },
  "infra/compose/docker-compose.dns.yml": {
    projectName: "compose",
    networkNames: ["compose_default"],
    volumeNames: []
  }
};
const mainServiceNames = new Set(["backend", "dashboard", "proxy", "dns"]);
const ansi = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  inverse: "\u001b[7m",
  cyan: "\u001b[36m",
  red: "\u001b[31m",
  yellow: "\u001b[33m"
} as const;

function style(text: string, ...codes: string[]): string {
  return `${codes.join("")}${text}${ansi.reset}`;
}

function listUnique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((a, b) => a.localeCompare(b));
}

function splitDockerLine(line: string): string[] {
  return line.split("|").map((value) => value.trim());
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function loadDotEnv(filePath: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  return fs
    .readFile(filePath, "utf8")
    .then((content) => {
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith("#")) {
          continue;
        }

        const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
        const separatorIndex = normalized.indexOf("=");
        if (separatorIndex <= 0) {
          continue;
        }

        const key = normalized.slice(0, separatorIndex).trim();
        let value = normalized.slice(separatorIndex + 1).trim();
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }

      return result;
    })
    .catch(() => result);
}

function toAbsolutePath(value: string | undefined, fallback: string): string {
  const target = value ?? fallback;
  return path.isAbsolute(target) ? target : path.resolve(rootDir, target);
}

function dockerOutput(args: string[], options: { cwd?: string } = {}): string {
  try {
    return execFileSync("docker", args, {
      cwd: options.cwd ?? rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return "";
  }
}

function dockerSuccess(args: string[], options: { cwd?: string } = {}): boolean {
  try {
    execFileSync("docker", args, {
      cwd: options.cwd ?? rootDir,
      stdio: ["ignore", "pipe", "pipe"]
    });
    return true;
  } catch {
    return false;
  }
}

function normalizeAbsolute(targetPath: string): string {
  return path.resolve(targetPath);
}

function isWithinDirectory(targetPath: string, parentPath: string): boolean {
  const relative = path.relative(normalizeAbsolute(parentPath), normalizeAbsolute(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isSafeTarget(targetPath: string): boolean {
  const normalized = normalizeAbsolute(targetPath);
  if (normalized.length === 0) {
    return false;
  }

  const blocked = new Set([normalizeAbsolute("/"), normalizeAbsolute(os.homedir()), normalizeAbsolute(rootDir)]);
  return !blocked.has(normalized);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function repairPathOwnership(targetPath: string): void {
  const resolvedPath = normalizeAbsolute(targetPath);
  const parentDir = path.dirname(resolvedPath);
  const baseName = path.basename(resolvedPath);

  dockerSuccess([
    "run",
    "--rm",
    "-v",
    `${parentDir}:/target-parent`,
    "alpine:3.20",
    "sh",
    "-lc",
    `if [ -e ${shellQuote(`/target-parent/${baseName}`)} ]; then chown -R ${currentUid}:${currentGid} ${shellQuote(`/target-parent/${baseName}`)}; fi`
  ]);
}

async function clearDirectoryContents(directoryPath: string): Promise<void> {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
    const entries = await fs.readdir(directoryPath);
    for (const entry of entries) {
      await fs.rm(path.join(directoryPath, entry), { recursive: true, force: true });
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code !== "EACCES" && code !== "EPERM") {
      throw error;
    }

    repairPathOwnership(directoryPath);
    await fs.mkdir(directoryPath, { recursive: true });
    const entries = await fs.readdir(directoryPath);
    for (const entry of entries) {
      await fs.rm(path.join(directoryPath, entry), { recursive: true, force: true });
    }
  }
}

async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.rm(filePath, { force: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code !== "EACCES" && code !== "EPERM") {
      throw error;
    }

    repairPathOwnership(filePath);
    await fs.rm(filePath, { force: true });
  }
}

async function listImmediateDirectories(directoryPath: string): Promise<string[]> {
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function listPathsRecursive(directoryPath: string): Promise<string[]> {
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const results: string[] = [];

  async function visit(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const nextPath = path.join(currentPath, entry.name);
      results.push(nextPath);
      if (entry.isDirectory()) {
        await visit(nextPath);
      }
    }
  }

  await visit(directoryPath);
  return results;
}

async function listEnvBackups(activeEnvPath: string): Promise<string[]> {
  const directoryPath = path.dirname(activeEnvPath);
  const basename = path.basename(activeEnvPath);
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${basename}.backup.`))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function listDockerContainers(): DockerContainerInfo[] {
  const raw = dockerOutput([
    "ps",
    "-a",
    "--format",
    '{{.ID}}|{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.service"}}|{{.Label "com.docker.compose.project.working_dir"}}'
  ]);

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [id = "", name = "", project = "", service = "", workingDir = ""] = splitDockerLine(line);
      return { id, name, project, service, workingDir: normalizeAbsolute(workingDir || ".") };
    })
    .filter((entry) => entry.id.length > 0);
}

function listDockerNetworks(): DockerNetworkInfo[] {
  const raw = dockerOutput([
    "network",
    "ls",
    "--format",
    '{{.Name}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.network"}}'
  ]);

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name = "", project = "", network = ""] = splitDockerLine(line);
      return { name, project, network };
    })
    .filter((entry) => entry.name.length > 0);
}

function listDockerVolumes(): DockerVolumeInfo[] {
  const raw = dockerOutput([
    "volume",
    "ls",
    "--format",
    '{{.Name}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.volume"}}'
  ]);

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name = "", project = "", volume = ""] = splitDockerLine(line);
      return { name, project, volume };
    })
    .filter((entry) => entry.name.length > 0);
}

function parseComposeConfigSummary(relativeComposeFile: (typeof composeFiles)[number]): ComposeConfigSummary {
  const fallback = mainComposeFallbacks[relativeComposeFile];
  const raw = dockerOutput(["compose", "-f", relativeComposeFile, "config", "--format", "json"], { cwd: rootDir });

  if (raw.length === 0) {
    return {
      file: relativeComposeFile,
      projectName: fallback.projectName,
      networkNames: fallback.networkNames,
      volumeNames: fallback.volumeNames
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      name?: string;
      networks?: Record<string, { name?: string }>;
      volumes?: Record<string, { name?: string }>;
    };

    return {
      file: relativeComposeFile,
      projectName: parsed.name?.trim() || fallback.projectName,
      networkNames: listUnique(
        Object.values(parsed.networks ?? {})
          .map((entry) => entry?.name?.trim() ?? "")
          .filter((value) => value.length > 0)
      ),
      volumeNames: listUnique(
        Object.values(parsed.volumes ?? {})
          .map((entry) => entry?.name?.trim() ?? "")
          .filter((value) => value.length > 0)
      )
    };
  } catch {
    return {
      file: relativeComposeFile,
      projectName: fallback.projectName,
      networkNames: fallback.networkNames,
      volumeNames: fallback.volumeNames
    };
  }
}

function isPotentialRuntimeProject(
  projectName: string,
  appDirectoryNames: string[],
  mainProjectNames: Set<string>
): boolean {
  if (projectName.length === 0 || mainProjectNames.has(projectName)) {
    return false;
  }

  if (projectName.startsWith("labcore-")) {
    return true;
  }

  return appDirectoryNames.some(
    (directoryName) =>
      projectName === directoryName ||
      projectName.startsWith(`${directoryName}-`) ||
      projectName.startsWith(`${directoryName}_`)
  );
}

export function parseResetArgs(argv: string[]): ParseArgsResult {
  let mode: DestroyMode = "soft";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--yes") {
      throw new Error("--yes is no longer supported. Please confirm interactively.");
    }
    if (token === "--force") {
      throw new Error("--force is no longer supported. Safety guards cannot be bypassed.");
    }
    if (token === "--mode") {
      const next = argv[index + 1];
      if (next !== "soft" && next !== "hard") {
        throw new Error(`Invalid mode: ${next ?? "(missing)"} (expected: soft, hard)`);
      }
      mode = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--mode=")) {
      const value = token.slice("--mode=".length);
      if (value !== "soft" && value !== "hard") {
        throw new Error(`Invalid mode: ${value} (expected: soft, hard)`);
      }
      mode = value;
      continue;
    }
    throw new Error(`Unsupported argument: ${token}`);
  }

  return { mode };
}

async function buildConfig(): Promise<ResetConfig> {
  const envValues = await loadDotEnv(envPath);
  return {
    rootDir,
    envPath,
    infraComposeDir: path.join(rootDir, "infra", "compose"),
    dbPath: toAbsolutePath(envValues.LAB_CORE_DB_PATH, "./core/backend/data/database.sqlite"),
    generatedSyncDir: toAbsolutePath(envValues.LAB_CORE_SYNC_DIR, "./core/backend/data/generated"),
    appsRoot: toAbsolutePath(envValues.LAB_CORE_APPS_ROOT, "./runtime/apps"),
    appDataRoot: toAbsolutePath(envValues.LAB_CORE_APPDATA_ROOT, "./runtime/appdata"),
    kernelNetworkName
  };
}

async function assertSafeTargets(config: ResetConfig, mode: DestroyMode, backupPaths: string[]): Promise<void> {
  const mustBeSafe = [config.generatedSyncDir];
  if (mode === "hard") {
    mustBeSafe.push(config.dbPath, config.appsRoot, config.appDataRoot, ...backupPaths);
  }

  if (mustBeSafe.some((targetPath) => !isSafeTarget(targetPath))) {
    throw new Error("reset refused: one or more configured paths are unsafe");
  }
}

async function discoverResetInventory(mode: DestroyMode, config: ResetConfig): Promise<ResetInventory> {
  const mainComposeConfigs = composeFiles.map((file) => parseComposeConfigSummary(file));
  const mainProjectNames = new Set(mainComposeConfigs.map((entry) => entry.projectName));
  const appDirectoryNames = await listImmediateDirectories(config.appsRoot);
  const containers = listDockerContainers();
  const networks = listDockerNetworks();
  const volumes = listDockerVolumes();
  const generatedArtifacts = await listPathsRecursive(config.generatedSyncDir);
  const backupPaths = await listEnvBackups(config.envPath);
  const dbArtifacts = [config.dbPath, `${config.dbPath}-wal`, `${config.dbPath}-shm`];
  const runtimeProjects = listUnique([
    ...containers
      .filter((entry) => isWithinDirectory(entry.workingDir, config.appsRoot))
      .map((entry) => entry.project),
    ...networks
      .map((entry) => entry.project)
      .filter((projectName) => isPotentialRuntimeProject(projectName, appDirectoryNames, mainProjectNames)),
    ...volumes
      .map((entry) => entry.project)
      .filter((projectName) => isPotentialRuntimeProject(projectName, appDirectoryNames, mainProjectNames))
  ]);

  const mainContainers = containers.filter(
    (entry) => mainServiceNames.has(entry.service) && isWithinDirectory(entry.workingDir, config.infraComposeDir)
  );
  const runtimeContainers = containers.filter(
    (entry) => runtimeProjects.includes(entry.project) || isWithinDirectory(entry.workingDir, config.appsRoot)
  );
  const containerMap = new Map<string, DockerContainerInfo>();
  for (const entry of [...mainContainers, ...runtimeContainers]) {
    containerMap.set(entry.id, entry);
  }

  const runtimeNetworks = networks
    .filter((entry) => runtimeProjects.includes(entry.project))
    .map((entry) => entry.name);
  const runtimeVolumes = volumes
    .filter((entry) => runtimeProjects.includes(entry.project))
    .map((entry) => entry.name);

  return {
    mode,
    config,
    mainComposeConfigs,
    runtimeProjects,
    containers: [...containerMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    networkNames: listUnique([
      config.kernelNetworkName,
      ...mainComposeConfigs.flatMap((entry) => entry.networkNames),
      ...runtimeNetworks
    ]),
    volumeNames: listUnique([
      ...mainComposeConfigs.flatMap((entry) => entry.volumeNames),
      ...runtimeVolumes
    ]),
    generatedArtifacts,
    dbArtifacts,
    backupPaths
  };
}

export function createResetPlan(inventory: ResetInventory): ResetPlan {
  const { mode, config } = inventory;

  return {
    mode,
    config,
    composeFiles: inventory.mainComposeConfigs.map((entry) => entry.file),
    runtimeProjects: inventory.runtimeProjects,
    deleteContainerIds: inventory.containers.map((entry) => entry.id),
    deleteContainerNames: inventory.containers.map((entry) => entry.name),
    deleteNetworkNames: inventory.networkNames,
    deleteGeneratedArtifacts: inventory.generatedArtifacts.length > 0 ? inventory.generatedArtifacts : [config.generatedSyncDir],
    deleteDbArtifacts: mode === "hard" ? inventory.dbArtifacts : [],
    deleteRuntimeRoots: mode === "hard" ? [config.appsRoot, config.appDataRoot] : [],
    deleteVolumeNames: mode === "hard" ? inventory.volumeNames : [],
    deleteBackupPaths: mode === "hard" ? inventory.backupPaths : [],
    keepDbArtifacts: mode === "soft" ? inventory.dbArtifacts : [],
    keepRuntimeRoots: mode === "soft" ? [config.appsRoot, config.appDataRoot] : [],
    keepVolumeNames: mode === "soft" ? inventory.volumeNames : [],
    keepBackupPaths: mode === "soft" ? inventory.backupPaths : [],
    keepActiveEnvPaths: [config.envPath],
    keepGitWorktreePaths: [config.rootDir]
  };
}

function renderItemLines(items: string[], emptyMessage: string): string[] {
  if (items.length === 0) {
    return [`  - ${emptyMessage}`];
  }
  return items.map((item) => `  - ${item}`);
}

function renderModeBanner(mode: DestroyMode): string[] {
  if (mode === "soft") {
    return [
      style("[SOFT DESTROY]", ansi.bold, ansi.cyan),
      style("Data-preserving cleanup", ansi.cyan),
      style("Volumes / backups / DB / app data: KEEP", ansi.cyan)
    ];
  }

  return [
    style("!!!!!!!!!!!!!!!!!!!!!!!!!!!!", ansi.bold, ansi.red),
    style("[HARD DESTROY]", ansi.bold, ansi.inverse, ansi.red),
    style("DESTRUCTIVE OPERATION", ansi.bold, ansi.red),
    style("Volumes / backups / DB / app data: DELETE", ansi.bold, ansi.red),
    style("This operation cannot be undone.", ansi.bold, ansi.red),
    style("!!!!!!!!!!!!!!!!!!!!!!!!!!!!", ansi.bold, ansi.red)
  ];
}

export function renderPreview(plan: ResetPlan): string {
  const lines: string[] = [];

  lines.push(...renderModeBanner(plan.mode));
  lines.push("");
  lines.push(`Mode: ${plan.mode}`);
  lines.push("");
  lines.push("Delete: containers");
  lines.push(...renderItemLines(plan.deleteContainerNames, "(none)"));
  lines.push("");
  lines.push("Delete: networks");
  lines.push(...renderItemLines(plan.deleteNetworkNames, "(none)"));
  lines.push("");
  lines.push("Delete: generated artifacts");
  lines.push(...renderItemLines(plan.deleteGeneratedArtifacts, "(none)"));

  if (plan.mode === "soft") {
    lines.push("");
    lines.push("Keep: DB artifacts");
    lines.push(...renderItemLines(plan.keepDbArtifacts, "(none)"));
    lines.push("");
    lines.push("Keep: Docker volumes");
    lines.push(...renderItemLines(plan.keepVolumeNames, "(none)"));
    lines.push("");
    lines.push("Keep: backups");
    lines.push(...renderItemLines(plan.keepBackupPaths, "(none found)"));
    lines.push("");
    lines.push("Keep: runtime apps / app data");
    lines.push(...renderItemLines(plan.keepRuntimeRoots, "(none)"));
  } else {
    lines.push("");
    lines.push("Delete: DB artifacts");
    lines.push(...renderItemLines(plan.deleteDbArtifacts, "(none)"));
    lines.push("");
    lines.push("Delete: runtime apps / app data roots");
    lines.push(...renderItemLines(plan.deleteRuntimeRoots, "(none)"));
    lines.push("");
    lines.push("Delete: Docker volumes");
    lines.push(...renderItemLines(plan.deleteVolumeNames, "(none)"));
    lines.push("");
    lines.push("Delete: backups");
    lines.push(...renderItemLines(plan.deleteBackupPaths, "(none found)"));
    lines.push("");
    lines.push("Keep: active .env");
    lines.push(...renderItemLines(plan.keepActiveEnvPaths, "(none)"));
    lines.push("");
    lines.push("Keep: Git worktree");
    lines.push(...renderItemLines(plan.keepGitWorktreePaths, "(none)"));
  }

  return lines.join("\n");
}

export function renderConfirmationPrompt(plan: ResetPlan): string {
  const destructiveText =
    plan.mode === "hard"
      ? "This is a destructive operation. Volumes, backups, DB, and app data will be deleted."
      : "This is a data-preserving cleanup. Volumes, backups, DB, and app data will be kept.";

  return [
    `Mode: ${plan.mode}`,
    destructiveText,
    `Containers to delete: ${plan.deleteContainerNames.length}`,
    `Networks to delete: ${plan.deleteNetworkNames.length}`,
    plan.mode === "hard" ? `Volumes to delete: ${plan.deleteVolumeNames.length}` : `Volumes to keep: ${plan.keepVolumeNames.length}`,
    plan.mode === "hard" ? "This operation cannot be undone." : "Generated files and containers will be recreated on the next startup.",
    "Type yes to continue. Any other input will cancel."
  ].join("\n");
}

export function isConfirmationApproved(value: string): boolean {
  return value === "yes";
}

export async function executeResetPlan(plan: ResetPlan, executor: ResetExecutor): Promise<void> {
  const removeVolumes = plan.mode === "hard";

  for (const composeFile of plan.composeFiles) {
    executor.composeDown(composeFile, removeVolumes);
  }

  for (const runtimeProject of plan.runtimeProjects) {
    executor.composeDownByProject(runtimeProject, removeVolumes);
  }

  if (plan.deleteContainerIds.length > 0) {
    executor.removeContainers(plan.deleteContainerIds);
  }

  if (plan.deleteNetworkNames.length > 0) {
    executor.removeNetworks(plan.deleteNetworkNames);
  }

  if (plan.deleteVolumeNames.length > 0) {
    executor.removeVolumes(plan.deleteVolumeNames);
  }

  for (const dbArtifact of plan.deleteDbArtifacts) {
    await executor.removeFileIfExists(dbArtifact);
  }

  for (const backupPath of plan.deleteBackupPaths) {
    await executor.removeFileIfExists(backupPath);
  }

  await executor.clearDirectoryContents(plan.config.generatedSyncDir);

  if (plan.mode === "hard") {
    await executor.clearDirectoryContents(plan.config.appsRoot);
    await executor.clearDirectoryContents(plan.config.appDataRoot);
  }
}

export function renderSummary(plan: ResetPlan): string {
  const lines = [
    `${plan.mode === "hard" ? "HARD" : "SOFT"} DESTROY completed`,
    `- Removed containers: ${plan.deleteContainerIds.length}`,
    `- Removed networks: ${plan.deleteNetworkNames.length}`,
    `- Cleared generated dir: ${plan.config.generatedSyncDir}`
  ];

  if (plan.mode === "hard") {
    lines.push(`- Removed volumes: ${plan.deleteVolumeNames.length}`);
    lines.push(`- Removed DB artifacts: ${plan.deleteDbArtifacts.length}`);
    lines.push(`- Removed backups: ${plan.deleteBackupPaths.length}`);
    lines.push(`- Cleared runtime apps dir: ${plan.config.appsRoot}`);
    lines.push(`- Cleared runtime data dir: ${plan.config.appDataRoot}`);
  } else {
    lines.push(`- Preserved DB artifacts: ${plan.keepDbArtifacts.length}`);
    lines.push(`- Preserved volumes: ${plan.keepVolumeNames.length}`);
    lines.push(`- Preserved backups: ${plan.keepBackupPaths.length}`);
    lines.push(`- Preserved runtime apps dir: ${plan.config.appsRoot}`);
    lines.push(`- Preserved runtime data dir: ${plan.config.appDataRoot}`);
  }

  lines.push(`- Preserved active .env: ${plan.config.envPath}`);
  lines.push(`- Preserved git worktree: ${plan.config.rootDir}`);
  return lines.join("\n");
}

function createExecutor(): ResetExecutor {
  return {
    composeDown(composeFile, removeVolumes) {
      const args = ["compose", "-f", composeFile, "down", "--remove-orphans"];
      if (removeVolumes) {
        args.push("-v");
      }
      dockerSuccess(args, { cwd: rootDir });
    },
    composeDownByProject(projectName, removeVolumes) {
      const args = ["compose", "-p", projectName, "down", "--remove-orphans"];
      if (removeVolumes) {
        args.push("-v");
      }
      dockerSuccess(args, { cwd: rootDir });
    },
    removeContainers(containerIds) {
      dockerSuccess(["rm", "-f", ...containerIds], { cwd: rootDir });
    },
    removeNetworks(networkNames) {
      for (const networkName of networkNames) {
        dockerSuccess(["network", "rm", networkName], { cwd: rootDir });
      }
    },
    removeVolumes(volumeNames) {
      if (volumeNames.length === 0) {
        return;
      }
      dockerSuccess(["volume", "rm", "-f", ...volumeNames], { cwd: rootDir });
    },
    clearDirectoryContents,
    removeFileIfExists
  };
}

function ensureInteractivePromptAvailable(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive confirmation is required. Re-run this command in a terminal.");
  }
}

async function promptForConfirmation(plan: ResetPlan): Promise<boolean> {
  ensureInteractivePromptAvailable();
  const answer = await input({
    message: renderConfirmationPrompt(plan),
    default: ""
  });
  return isConfirmationApproved(answer.trim());
}

async function main(): Promise<void> {
  const { mode } = parseResetArgs(process.argv.slice(2));
  const config = await buildConfig();
  const inventory = await discoverResetInventory(mode, config);
  await assertSafeTargets(config, mode, inventory.backupPaths);
  const plan = createResetPlan(inventory);

  console.log(renderPreview(plan));
  console.log("");

  const approved = await promptForConfirmation(plan);
  if (!approved) {
    console.log("Cancelled. No destructive changes were applied.");
    process.exit(0);
  }

  await executeResetPlan(plan, createExecutor());
  console.log(renderSummary(plan));
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return normalizeAbsolute(entry) === normalizeAbsolute(thisFile);
}

if (isDirectExecution()) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[reset-lab-core] failed: ${message}`);
    process.exit(1);
  });
}

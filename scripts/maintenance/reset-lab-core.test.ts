import assert from "node:assert/strict";
import test from "node:test";
import type { ResetConfig, ResetExecutor, ResetInventory } from "./reset-lab-core";
import {
  createResetPlan,
  executeResetPlan,
  isConfirmationApproved,
  parseResetArgs,
  renderConfirmationPrompt,
  renderPreview
} from "./reset-lab-core";

function createConfig(): ResetConfig {
  return {
    rootDir: "/workspace/LabWebSystem-Core",
    envPath: "/workspace/LabWebSystem-Core/core/backend/.env",
    infraComposeDir: "/workspace/LabWebSystem-Core/infra/compose",
    dbPath: "/workspace/LabWebSystem-Core/core/backend/data/database.sqlite",
    generatedSyncDir: "/workspace/LabWebSystem-Core/core/backend/data/generated",
    appsRoot: "/workspace/LabWebSystem-Core/runtime/apps",
    appDataRoot: "/workspace/LabWebSystem-Core/runtime/appdata",
    kernelNetworkName: "labcore-kernel"
  };
}

function createInventory(mode: "soft" | "hard"): ResetInventory {
  const config = createConfig();

  return {
    mode,
    config,
    mainComposeConfigs: [
      {
        file: "infra/compose/docker-compose.dev.yml",
        projectName: "compose",
        networkNames: ["compose_default", "labcore-kernel"],
        volumeNames: ["compose_labcore_node_modules"]
      },
      {
        file: "infra/compose/docker-compose.proxy.yml",
        projectName: "labcore-dev-proxy",
        networkNames: ["labcore-dev-proxy_default", "labcore-kernel"],
        volumeNames: []
      }
    ],
    runtimeProjects: ["homepage-sample-aajt04fu"],
    containers: [
      {
        id: "container-backend",
        name: "compose-backend-1",
        project: "compose",
        service: "backend",
        workingDir: "/workspace/LabWebSystem-Core/infra/compose"
      },
      {
        id: "container-app",
        name: "homepage-sample-aajt04fu-web-1",
        project: "homepage-sample-aajt04fu",
        service: "web",
        workingDir: "/workspace/LabWebSystem-Core/runtime/apps/homepage-sample"
      }
    ],
    networkNames: ["compose_default", "homepage-sample-aajt04fu_backend", "labcore-kernel"],
    volumeNames: ["compose_labcore_node_modules", "homepage_dbdata"],
    generatedArtifacts: [
      "/workspace/LabWebSystem-Core/core/backend/data/generated/Caddyfile",
      "/workspace/LabWebSystem-Core/core/backend/data/generated/fukaya-sus.hosts"
    ],
    dbArtifacts: [
      "/workspace/LabWebSystem-Core/core/backend/data/database.sqlite",
      "/workspace/LabWebSystem-Core/core/backend/data/database.sqlite-wal",
      "/workspace/LabWebSystem-Core/core/backend/data/database.sqlite-shm"
    ],
    backupPaths: ["/workspace/LabWebSystem-Core/core/backend/.env.backup.20260620111857"]
  };
}

function createExecutorRecorder() {
  const calls = {
    composeDown: [] as Array<{ composeFile: string; removeVolumes: boolean }>,
    composeDownByProject: [] as Array<{ projectName: string; removeVolumes: boolean }>,
    removeContainers: [] as string[][],
    removeNetworks: [] as string[][],
    removeVolumes: [] as string[][],
    clearDirectoryContents: [] as string[],
    removeFileIfExists: [] as string[]
  };

  const executor: ResetExecutor = {
    composeDown(composeFile, removeVolumes) {
      calls.composeDown.push({ composeFile, removeVolumes });
    },
    composeDownByProject(projectName, removeVolumes) {
      calls.composeDownByProject.push({ projectName, removeVolumes });
    },
    removeContainers(containerIds) {
      calls.removeContainers.push(containerIds);
    },
    removeNetworks(networkNames) {
      calls.removeNetworks.push(networkNames);
    },
    removeVolumes(volumeNames) {
      calls.removeVolumes.push(volumeNames);
    },
    async clearDirectoryContents(directoryPath) {
      calls.clearDirectoryContents.push(directoryPath);
    },
    async removeFileIfExists(filePath) {
      calls.removeFileIfExists.push(filePath);
    }
  };

  return { executor, calls };
}

test("parseResetArgs defaults to soft mode and accepts hard mode", () => {
  assert.deepEqual(parseResetArgs([]), { mode: "soft" });
  assert.deepEqual(parseResetArgs(["--mode", "hard"]), { mode: "hard" });
  assert.deepEqual(parseResetArgs(["--mode=soft"]), { mode: "soft" });
});

test("parseResetArgs rejects deprecated and invalid options", () => {
  assert.throws(() => parseResetArgs(["--yes"]), /no longer supported/);
  assert.throws(() => parseResetArgs(["--force"]), /cannot be bypassed/);
  assert.throws(() => parseResetArgs(["--mode", "dangerous"]), /expected: soft, hard/);
});

test("confirmation requires exact yes", () => {
  assert.equal(isConfirmationApproved("yes"), true);
  assert.equal(isConfirmationApproved("YES"), false);
  assert.equal(isConfirmationApproved("y"), false);
  assert.equal(isConfirmationApproved(""), false);
  assert.equal(isConfirmationApproved("no"), false);
});

test("soft preview and confirmation emphasize preserved data", () => {
  const plan = createResetPlan(createInventory("soft"));
  const preview = renderPreview(plan);
  const confirmation = renderConfirmationPrompt(plan);

  assert.match(preview, /SOFT DESTROY/);
  assert.match(preview, /Data-preserving cleanup/);
  assert.match(preview, /Keep: Docker volumes/);
  assert.match(confirmation, /Volumes to keep: 2/);
  assert.match(confirmation, /Type yes to continue/);
});

test("hard preview and confirmation emphasize destructive scope", () => {
  const plan = createResetPlan(createInventory("hard"));
  const preview = renderPreview(plan);
  const confirmation = renderConfirmationPrompt(plan);

  assert.match(preview, /HARD DESTROY/);
  assert.match(preview, /DESTRUCTIVE OPERATION/);
  assert.match(preview, /Delete: Docker volumes/);
  assert.match(confirmation, /Volumes to delete: 2/);
  assert.match(confirmation, /cannot be undone/);
});

test("executeResetPlan soft never removes volumes db backups or runtime roots", async () => {
  const plan = createResetPlan(createInventory("soft"));
  const { executor, calls } = createExecutorRecorder();

  await executeResetPlan(plan, executor);

  assert.deepEqual(
    calls.composeDown,
    plan.composeFiles.map((composeFile) => ({ composeFile, removeVolumes: false }))
  );
  assert.deepEqual(calls.composeDownByProject, [{ projectName: "homepage-sample-aajt04fu", removeVolumes: false }]);
  assert.deepEqual(calls.removeContainers, [plan.deleteContainerIds]);
  assert.deepEqual(calls.removeNetworks, [plan.deleteNetworkNames]);
  assert.deepEqual(calls.removeVolumes, []);
  assert.deepEqual(calls.removeFileIfExists, []);
  assert.deepEqual(calls.clearDirectoryContents, [plan.config.generatedSyncDir]);
});

test("executeResetPlan hard removes volumes db backups and runtime roots", async () => {
  const plan = createResetPlan(createInventory("hard"));
  const { executor, calls } = createExecutorRecorder();

  await executeResetPlan(plan, executor);

  assert.deepEqual(
    calls.composeDown,
    plan.composeFiles.map((composeFile) => ({ composeFile, removeVolumes: true }))
  );
  assert.deepEqual(calls.composeDownByProject, [{ projectName: "homepage-sample-aajt04fu", removeVolumes: true }]);
  assert.deepEqual(calls.removeContainers, [plan.deleteContainerIds]);
  assert.deepEqual(calls.removeNetworks, [plan.deleteNetworkNames]);
  assert.deepEqual(calls.removeVolumes, [plan.deleteVolumeNames]);
  assert.deepEqual(calls.removeFileIfExists, [...plan.deleteDbArtifacts, ...plan.deleteBackupPaths]);
  assert.deepEqual(calls.clearDirectoryContents, [
    plan.config.generatedSyncDir,
    plan.config.appsRoot,
    plan.config.appDataRoot
  ]);
});

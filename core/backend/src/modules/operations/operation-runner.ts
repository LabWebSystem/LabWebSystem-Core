import fs from "node:fs";
import type Database from "better-sqlite3";
import { simpleGit } from "simple-git";
import { env } from "../../lib/env.js";
import {
  getApplicationLabCoreRoot,
  getApplicationRoot
} from "../../services/application-paths.js";
import { recordSystemEvent } from "../events/event.repository.js";
import { OperationLogRepository } from "./operation-log.repository.js";
import { type OperationEventBus } from "./operation-events.js";
import { OperationRepository } from "./operation.repository.js";
import { redactJsonRecord, redactText } from "./redaction.js";
import type { OperationParameters, OperationStepDto, OperationType } from "./operation-types.js";
import {
  ensureRepository,
  getAppDataPath,
  getCommitInfo,
  getRepositoryPath,
  getRuntimeApplicationTarget,
  getSecretValues,
  markApplicationDeleted,
  prepareComposeRuntime,
  reconcileDeploymentRouting,
  resolveProjectName,
  setApplicationStatus,
  setCommitInfo,
  setCommitPair,
  setDeploymentEnabled,
  upsertUpdateInfo
} from "./application-runtime.js";
import { runCommand } from "../../services/command-runner.js";

type SyncInfrastructureFn = (reason: string) => unknown | Promise<unknown>;

type OperationRunnerOptions = {
  db: Database.Database;
  now?: () => string;
  eventBus: OperationEventBus;
  syncInfrastructure?: SyncInfrastructureFn;
  executionMode?: "dry-run" | "execute";
};

export class OperationRunner {
  private readonly repository: OperationRepository;
  private readonly logs: OperationLogRepository;
  private readonly db: Database.Database;
  private readonly now: () => string;
  private readonly eventBus: OperationEventBus;
  private readonly syncInfrastructure: SyncInfrastructureFn;
  private readonly executionMode: "dry-run" | "execute";
  private readonly sequenceByOperation = new Map<string, number>();

  constructor(options: OperationRunnerOptions) {
    this.db = options.db;
    this.repository = new OperationRepository(options.db);
    this.logs = new OperationLogRepository(options.db);
    this.now = options.now ?? (() => new Date().toISOString());
    this.eventBus = options.eventBus;
    this.syncInfrastructure = options.syncInfrastructure ?? (() => {});
    this.executionMode = options.executionMode ?? env.executionMode;
  }

  private async runAppRootDeleteHelper(applicationId: string): Promise<void> {
    const command = env.appRootDeleteUsesSudo
      ? { executable: "sudo", args: ["--non-interactive", process.execPath, env.appRootDeleteHelperPath, applicationId] }
      : { executable: process.execPath, args: [env.appRootDeleteHelperPath, applicationId] };

    await runCommand(command.executable, command.args, {
      executionModeOverride: this.executionMode
    });
  }

  async executeOperation(operationId: string): Promise<void> {
    const operation = this.repository.getOperation(operationId);
    if (operation.status !== "queued") {
      return;
    }

    const started = this.repository.startOperation(operationId, this.now());
    this.publishOperation(started.operationId);

    try {
      switch (operation.type) {
        case "deploy":
          await this.executeDeploy(operationId, operation.parameters);
          return;
        case "restart":
          await this.executeRestart(operationId);
          return;
        case "stop":
          await this.executeStop(operationId);
          return;
        case "resume":
          await this.executeResume(operationId);
          return;
        case "rebuild":
          await this.executeRebuild(operationId, operation.parameters);
          return;
        case "update-check":
          await this.executeUpdateCheck(operationId);
          return;
        case "update":
          await this.executeUpdate(operationId, operation.parameters);
          return;
        case "rollback":
          await this.executeRollback(operationId, operation.parameters);
          return;
        case "delete":
          await this.executeDelete(operationId, operation.parameters);
          return;
      }
    } catch (error) {
      const current = this.repository.getOperation(operationId);
      if (current.status !== "failed") {
        const message = error instanceof Error ? error.message : "Operation execution failed.";
        this.repository.completeOperation(operationId, {
          status: "failed",
          updatedAt: this.now(),
          errorCode: "OPERATION_EXECUTION_FAILED",
          errorMessage: message,
          errorDetails: { operationId }
        });
        this.publishOperation(operationId);
      }
      throw error;
    }
  }

  private async executeDeploy(operationId: string, parameters: Record<string, unknown>): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const composeProjectName = resolveProjectName(target);

    setApplicationStatus(this.db, target.application_id, "Cloning", this.now());
    await this.runStep(operationId, 1, "Resolving repository target.", secretValues, async (step) => {
      this.writeSystemLog(operationId, step.stepId, `repository=${target.repository_url} branch=${target.default_branch}`, secretValues);
    });

    const repository = await this.runStep(operationId, 2, "Cloning or pulling the repository.", secretValues, async (step) => {
      const ensured = await ensureRepository(target, this.executionMode);
      setCommitInfo(this.db, target.application_id, ensured.headCommit, this.now());
      this.writeSystemLog(operationId, step.stepId, `HEAD=${ensured.headCommit}`, secretValues);
      return ensured;
    });

    const preparedCompose = prepareComposeRuntime(target, repository.repoPath, this.executionMode);

    setApplicationStatus(this.db, target.application_id, "Deploying", this.now());
    await this.runStep(operationId, 3, "Inspecting compose configuration.", secretValues, async (step) => {
      const routing = reconcileDeploymentRouting(
        this.db,
        target.application_id,
        preparedCompose.composeFilePath,
        target.public_service_name,
        target.public_port,
        this.executionMode
      );
      this.writeSystemLog(operationId, step.stepId, routing.reason, secretValues);
    });

    await this.runStep(operationId, 4, "Running docker compose up with build.", secretValues, async (step) => {
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "up", "-d", "--build", "--remove-orphans"], repository.repoPath, secretValues);
    });

    await this.runStep(operationId, 5, "Synchronizing generated infrastructure assets.", secretValues, async (step) => {
      await this.syncInfrastructure(`deploy:${target.name}`);
      this.writeSystemLog(operationId, step.stepId, `syncInfrastructure deploy:${target.name}`, secretValues);
    });

    setApplicationStatus(this.db, target.application_id, "Running", this.now());
    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: redactJsonRecord({ executionMode: this.executionMode, rebuild: parameters.rebuild === true }, { secretValues })
    });
    recordSystemEvent(this.db, {
      scope: "deployment",
      applicationId: target.application_id,
      level: "info",
      title: "デプロイが完了しました",
      message: `アプリ ${target.name} の deploy operation が完了しました。`,
      createdAt: this.now()
    });
    this.publishOperation(operationId);
  }

  private async executeRestart(operationId: string): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const repoPath = getRepositoryPath(target.application_id);
    const preparedCompose = prepareComposeRuntime(target, repoPath, this.executionMode);
    const composeProjectName = resolveProjectName(target);

    setApplicationStatus(this.db, target.application_id, "Deploying", this.now());
    await this.runStep(operationId, 1, "Restarting containers.", secretValues, async (step) => {
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "restart"], repoPath, secretValues);
    });

    setApplicationStatus(this.db, target.application_id, "Running", this.now());
    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { executionMode: this.executionMode }
    });
    this.publishOperation(operationId);
  }

  private async executeStop(operationId: string): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const repoPath = getRepositoryPath(target.application_id);
    const preparedCompose = prepareComposeRuntime(target, repoPath, this.executionMode);
    const composeProjectName = resolveProjectName(target);

    setApplicationStatus(this.db, target.application_id, "Deploying", this.now());
    await this.runStep(operationId, 1, "Stopping docker compose services.", secretValues, async (step) => {
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "stop"], repoPath, secretValues);
    });

    await this.runStep(operationId, 2, "Synchronizing infrastructure after stop.", secretValues, async (step) => {
      setDeploymentEnabled(this.db, target.application_id, false);
      await this.syncInfrastructure(`stop:${target.name}`);
      this.writeSystemLog(operationId, step.stepId, `syncInfrastructure stop:${target.name}`, secretValues);
    });

    setApplicationStatus(this.db, target.application_id, "Stopped", this.now());
    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { executionMode: this.executionMode }
    });
    this.publishOperation(operationId);
  }

  private async executeResume(operationId: string): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const repoPath = getRepositoryPath(target.application_id);
    const preparedCompose = prepareComposeRuntime(target, repoPath, this.executionMode);
    const composeProjectName = resolveProjectName(target);

    await this.runStep(operationId, 1, "Resuming docker compose services.", secretValues, async (step) => {
      setDeploymentEnabled(this.db, target.application_id, true);
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "up", "-d", "--build", "--remove-orphans"], repoPath, secretValues);
    });

    await this.runStep(operationId, 2, "Synchronizing infrastructure after resume.", secretValues, async (step) => {
      await this.syncInfrastructure(`resume:${target.name}`);
      this.writeSystemLog(operationId, step.stepId, `syncInfrastructure resume:${target.name}`, secretValues);
    });

    setApplicationStatus(this.db, target.application_id, "Running", this.now());
    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { executionMode: this.executionMode }
    });
    this.publishOperation(operationId);
  }

  private async executeRebuild(operationId: string, parameters: Record<string, unknown>): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const repoPath = getRepositoryPath(target.application_id);
    const preparedCompose = prepareComposeRuntime(target, repoPath, this.executionMode);
    const composeProjectName = resolveProjectName(target);
    const keepData = parameters.keepData !== false;

    setApplicationStatus(this.db, target.application_id, "Rebuilding", this.now());
    await this.runStep(operationId, 1, "Tearing down existing compose resources.", secretValues, async (step) => {
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "down", "--remove-orphans", ...(keepData ? [] : ["-v"])], repoPath, secretValues);
    });
    await this.runStep(operationId, 2, "Building and starting compose resources.", secretValues, async (step) => {
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "up", "-d", "--build", "--remove-orphans"], repoPath, secretValues);
    });
    await this.runStep(operationId, 3, "Synchronizing infrastructure after rebuild.", secretValues, async (step) => {
      await this.syncInfrastructure(`rebuild:${target.name}`);
      this.writeSystemLog(operationId, step.stepId, `syncInfrastructure rebuild:${target.name}`, secretValues);
    });

    setApplicationStatus(this.db, target.application_id, "Running", this.now());
    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { executionMode: this.executionMode, keepData }
    });
    this.publishOperation(operationId);
  }

  private async executeUpdateCheck(operationId: string): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const repoPath = getRepositoryPath(target.application_id);
    let currentCommit = target.current_commit ?? "dry-run-current";
    let latestRemoteCommit = currentCommit;

    await this.runStep(operationId, 1, "Resolving repository for update check.", secretValues, async (step) => {
      if (this.executionMode === "dry-run") {
        this.writeSystemLog(operationId, step.stepId, "dry-run repository resolution", secretValues);
        return;
      }

      const git = simpleGit(repoPath);
      await git.fetch();
      currentCommit = (await git.revparse(["HEAD"])).trim();
      latestRemoteCommit = (await git.revparse([`origin/${target.default_branch}`])).trim();
    });
    await this.runStep(operationId, 2, "Fetching remote revision metadata.", secretValues, async (step) => {
      if (env.executionMode === "dry-run") {
        latestRemoteCommit = `dry-run-remote-${Date.now()}`;
      }
      const hasUpdate = currentCommit !== latestRemoteCommit;
      upsertUpdateInfo(this.db, target.application_id, currentCommit, latestRemoteCommit, hasUpdate, this.now());
      this.writeSystemLog(operationId, step.stepId, `current=${currentCommit} latest=${latestRemoteCommit}`, secretValues);
    });

    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { currentCommit, latestRemoteCommit, hasUpdate: currentCommit !== latestRemoteCommit }
    });
    this.publishOperation(operationId);
  }

  private async executeUpdate(operationId: string, parameters: Record<string, unknown>): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const composeProjectName = resolveProjectName(target);

    const repository = await this.runStep(operationId, 1, "Resolving repository target.", secretValues, async (step) => {
      this.writeSystemLog(operationId, step.stepId, `repository=${target.repository_url}`, secretValues);
      return { repoPath: getRepositoryPath(target.application_id) };
    });

    const pulled = await this.runStep(operationId, 2, "Pulling latest repository revision.", secretValues, async (step) => {
      const ensured = await ensureRepository(target, this.executionMode);
      setCommitInfo(this.db, target.application_id, ensured.headCommit, this.now());
      this.writeSystemLog(operationId, step.stepId, `HEAD=${ensured.headCommit}`, secretValues);
      return ensured;
    });

    const preparedCompose = prepareComposeRuntime(target, repository.repoPath, this.executionMode);

    await this.runStep(operationId, 3, "Inspecting compose configuration.", secretValues, async (step) => {
      const routing = reconcileDeploymentRouting(
        this.db,
        target.application_id,
        preparedCompose.composeFilePath,
        target.public_service_name,
        target.public_port,
        this.executionMode
      );
      this.writeSystemLog(operationId, step.stepId, routing.reason, secretValues);
    });

    await this.runStep(operationId, 4, "Applying compose update.", secretValues, async (step) => {
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "up", "-d", "--build", "--remove-orphans"], repository.repoPath, secretValues);
    });

    await this.runStep(operationId, 5, "Synchronizing infrastructure after update.", secretValues, async (step) => {
      await this.syncInfrastructure(`update:${target.name}`);
      this.writeSystemLog(operationId, step.stepId, `syncInfrastructure update:${target.name}`, secretValues);
    });

    setApplicationStatus(this.db, target.application_id, "Running", this.now());
    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { executionMode: this.executionMode, targetRevision: parameters.targetRevision ?? null, currentCommit: pulled.headCommit }
    });
    this.publishOperation(operationId);
  }

  private async executeRollback(operationId: string, parameters: Record<string, unknown>): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const composeProjectName = resolveProjectName(target);
    const commitInfo = getCommitInfo(this.db, target.application_id);
    const rollbackTarget = typeof parameters.targetRevision === "string" && parameters.targetRevision.length > 0
      ? parameters.targetRevision
      : commitInfo.previousCommit;

    if (!rollbackTarget) {
      throw new Error("No rollback target revision is available.");
    }

    const repository = await this.runStep(operationId, 1, "Resolving repository target.", secretValues, async () => {
      return { repoPath: getRepositoryPath(target.application_id) };
    });

    await this.runStep(operationId, 2, "Checking out rollback target revision.", secretValues, async (step) => {
      if (this.executionMode !== "dry-run") {
        const git = simpleGit(repository.repoPath);
        await git.fetch();
        await git.checkout(rollbackTarget);
      }
      this.writeSystemLog(operationId, step.stepId, `rollbackTarget=${rollbackTarget}`, secretValues);
    });

    const preparedCompose = prepareComposeRuntime(target, repository.repoPath, this.executionMode);

    await this.runStep(operationId, 3, "Inspecting compose configuration.", secretValues, async (step) => {
      const routing = reconcileDeploymentRouting(
        this.db,
        target.application_id,
        preparedCompose.composeFilePath,
        target.public_service_name,
        target.public_port,
        this.executionMode
      );
      this.writeSystemLog(operationId, step.stepId, routing.reason, secretValues);
    });

    await this.runStep(operationId, 4, "Applying rollback compose revision.", secretValues, async (step) => {
      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "up", "-d", "--build", "--remove-orphans"], repository.repoPath, secretValues);
    });

    await this.runStep(operationId, 5, "Synchronizing infrastructure after rollback.", secretValues, async (step) => {
      await this.syncInfrastructure(`rollback:${target.name}`);
      this.writeSystemLog(operationId, step.stepId, `syncInfrastructure rollback:${target.name}`, secretValues);
    });

    setCommitPair(this.db, target.application_id, rollbackTarget, commitInfo.currentCommit, this.now());
    setApplicationStatus(this.db, target.application_id, "Running", this.now());
    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { executionMode: this.executionMode, rollbackTarget }
    });
    this.publishOperation(operationId);
  }

  private async executeDelete(operationId: string, parameters: Record<string, unknown>): Promise<void> {
    const target = getRuntimeApplicationTarget(this.db, this.repository.getOperation(operationId).applicationId);
    const secretValues = getSecretValues(target);
    const composeProjectName = resolveProjectName(target);
    const repoPath = getRepositoryPath(target.application_id);
    const appDataPath = getAppDataPath(target.application_id);
    const labCorePath = getApplicationLabCoreRoot(target.application_id);
    const appRootPath = getApplicationRoot(target.application_id);
    const mode = typeof parameters.mode === "string" ? parameters.mode : "configOnly";
    const keepData = mode !== "full";

    await this.runStep(operationId, 1, "Preparing delete operation and releasing exposure on completion.", secretValues, async (step) => {
      this.writeSystemLog(operationId, step.stepId, `delete mode=${mode}`, secretValues);
    });

    await this.runStep(operationId, 2, "Stopping compose resources for delete.", secretValues, async (step) => {
      if (mode !== "full") {
        this.writeSystemLog(operationId, step.stepId, "container resources kept for non-full delete", secretValues);
        return;
      }

      try {
        const preparedCompose = prepareComposeRuntime(target, repoPath, this.executionMode);
        if (fs.existsSync(preparedCompose.composeFilePath)) {
          await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "-f", preparedCompose.composeFilePath, ...(preparedCompose.envFilePath ? ["--env-file", preparedCompose.envFilePath] : []), "down", "--remove-orphans", ...(keepData ? [] : ["-v"])], repoPath, secretValues);
          return;
        }
      } catch (error) {
        this.writeSystemLog(
          operationId,
          step.stepId,
          `normalized compose unavailable, fallback to project-only down: ${error instanceof Error ? error.message : String(error)}`,
          secretValues
        );
      }

      await this.executeLoggedCommand(step, "docker", ["compose", "-p", composeProjectName, "down", "--remove-orphans", ...(keepData ? [] : ["-v"])], undefined, secretValues);
    });

    await this.runStep(operationId, 3, "Cleaning up source directory when requested.", secretValues, async (step) => {
      if (mode === "full") {
        await this.runAppRootDeleteHelper(target.application_id);
        this.writeSystemLog(operationId, step.stepId, `removed app root ${appRootPath} via helper`, secretValues);
        return;
      }
      if (mode === "sourceAndConfig") {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(labCorePath, { recursive: true, force: true });
        this.writeSystemLog(operationId, step.stepId, `removed source directory ${repoPath}`, secretValues);
        return;
      }
      this.writeSystemLog(operationId, step.stepId, "source and app root kept", secretValues);
    });

    await this.runStep(operationId, 4, "Cleaning up appdata when requested.", secretValues, async (step) => {
      if (mode === "full") {
        this.writeSystemLog(operationId, step.stepId, `app root helper removed data under ${appDataPath}`, secretValues);
        return;
      }
      this.writeSystemLog(operationId, step.stepId, "appdata kept", secretValues);
    });

    await this.runStep(operationId, 5, "Synchronizing infrastructure after delete.", secretValues, async (step) => {
      markApplicationDeleted(this.db, target.application_id, this.now());
      await this.syncInfrastructure(`delete:${target.name}`);
      this.writeSystemLog(operationId, step.stepId, `syncInfrastructure delete:${target.name}`, secretValues);
    });

    this.repository.completeOperation(operationId, {
      status: "succeeded",
      updatedAt: this.now(),
      result: { executionMode: this.executionMode, mode }
    });
    this.publishOperation(operationId);
  }

  private async runStep<T>(
    operationId: string,
    stepOrder: number,
    message: string,
    secretValues: string[],
    callback: (step: OperationStepDto) => Promise<T> | T
  ): Promise<T> {
    const step = this.repository.steps.getByOperationAndOrder(operationId, stepOrder);
    if (!step) {
      throw new Error(`Step ${stepOrder} not found for operation ${operationId}.`);
    }

    const startedAt = this.now();
    const runningStep = this.repository.steps.updateStep(step.stepId, {
      status: "running",
      updatedAt: startedAt,
      startedAt,
      message: redactText(message, { secretValues })
    });
    this.repository.setCurrentStep(operationId, {
      stepId: runningStep.stepId,
      stepName: runningStep.name,
      stepOrder: runningStep.stepOrder,
      updatedAt: startedAt
    });
    this.publishStep(runningStep);
    this.publishOperation(operationId);
    this.writeSystemLog(operationId, runningStep.stepId, message, secretValues);

    try {
      const result = await callback(runningStep);
      const finishedAt = this.now();
      const completedStep = this.repository.steps.updateStep(runningStep.stepId, {
        status: "succeeded",
        updatedAt: finishedAt,
        finishedAt,
        message: redactText(message, { secretValues })
      });
      this.publishStep(completedStep);
      this.publishOperation(operationId);
      return result;
    } catch (error) {
      const failedAt = this.now();
      const errorMessage = redactText(error instanceof Error ? error.message : "Step execution failed.", { secretValues });
      const failedStep = this.repository.steps.updateStep(runningStep.stepId, {
        status: "failed",
        updatedAt: failedAt,
        finishedAt: failedAt,
        message: errorMessage,
        errorCode: "OPERATION_STEP_FAILED",
        details: { stepOrder: runningStep.stepOrder, stepName: runningStep.name }
      });
      this.repository.completeOperation(operationId, {
        status: "failed",
        updatedAt: failedAt,
        errorCode: "OPERATION_FAILED",
        errorMessage,
        errorDetails: {
          operationId,
          failedStepId: failedStep.stepId,
          failedStepName: failedStep.name
        }
      });

      const applicationId = this.repository.getOperation(operationId).applicationId;
      const deletedRow = this.db
        .prepare("SELECT deleted_at FROM applications WHERE application_id = ?")
        .get(applicationId) as { deleted_at: string | null } | undefined;
      if (deletedRow && !deletedRow.deleted_at) {
        setApplicationStatus(this.db, applicationId, "Failed", failedAt);
      }

      this.publishStep(failedStep);
      this.publishOperation(operationId);
      recordSystemEvent(this.db, {
        scope: "operation",
        applicationId,
        level: "error",
        title: "Operation が失敗しました",
        message: errorMessage,
        createdAt: failedAt
      });
      throw error;
    }
  }

  private publishOperation(operationId: string): void {
    const operation = this.repository.getOperation(operationId);
    this.eventBus.publish({
      type: "operation",
      operationId,
      payload: operation
    });
  }

  private publishStep(step: OperationStepDto): void {
    this.eventBus.publish({
      type: "step",
      operationId: step.operationId,
      payload: step
    });
  }

  private writeSystemLog(operationId: string, stepId: string | null, line: string, secretValues: string[]): void {
    this.writeLog(operationId, stepId, "system", line, secretValues);
  }

  private writeLog(
    operationId: string,
    stepId: string | null,
    stream: "stdout" | "stderr" | "system",
    line: string,
    secretValues: string[]
  ): void {
    const redactedLine = redactText(line, { secretValues });
    const sequence = this.nextSequence(operationId);
    const createdAt = this.now();
    const inserted = this.logs.appendLog({
      operationId,
      stepId,
      sequence,
      stream,
      line: redactedLine,
      createdAt
    });

    if (!inserted) {
      return;
    }

    this.eventBus.publish({
      type: "log",
      operationId,
      payload: {
        operationId,
        sequence,
        stepId,
        stream,
        line: redactedLine,
        createdAt
      }
    });
  }

  private nextSequence(operationId: string): number {
    const current = this.sequenceByOperation.get(operationId);
    if (typeof current === "number") {
      const next = current + 1;
      this.sequenceByOperation.set(operationId, next);
      return next;
    }

    const next = this.logs.getMaxSequence(operationId) + 1;
    this.sequenceByOperation.set(operationId, next);
    return next;
  }

  private async executeLoggedCommand(
    step: OperationStepDto,
    command: string,
    args: string[],
    cwd: string | undefined,
    secretValues: string[]
  ): Promise<void> {
    const result = await runCommand(command, args, { cwd, executionModeOverride: this.executionMode });
    this.writeSystemLog(step.operationId, step.stepId, `$ ${result.command}`, secretValues);

    for (const line of result.stdout.split(/\r?\n/).map((item) => item.trimEnd()).filter((item) => item.length > 0)) {
      this.writeLog(step.operationId, step.stepId, "stdout", line, secretValues);
    }
    for (const line of result.stderr.split(/\r?\n/).map((item) => item.trimEnd()).filter((item) => item.length > 0)) {
      this.writeLog(step.operationId, step.stepId, "stderr", line, secretValues);
    }
  }
}

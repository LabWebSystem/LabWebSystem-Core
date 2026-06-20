import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { applySchema } from "../lib/schema.js";
import { OperationConflictError } from "../modules/operations/operation-errors.js";
import { InMemoryOperationEventBus } from "../modules/operations/operation-events.js";
import { OperationService } from "../modules/operations/operation.service.js";

function insertApplication(db: Database.Database, applicationId: string, name = "demo-app"): void {
  db.prepare(
    `
      INSERT INTO applications (
        application_id,
        name,
        description,
        repository_url,
        default_branch,
        current_commit,
        previous_commit,
        status,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    applicationId,
    name,
    "demo",
    "https://github.com/example/demo-app.git",
    "main",
    null,
    null,
    "Registered",
    null,
    "2026-06-20T00:00:00.000Z",
    "2026-06-20T00:00:00.000Z"
  );

  db.prepare(
    `
      INSERT INTO deployments (
        deployment_id,
        application_id,
        compose_path,
        compose_project_name,
        public_service_name,
        public_port,
        hostname,
        mode,
        keep_volumes_on_rebuild,
        device_requirements,
        env_overrides,
        enabled,
        released_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    `dep-${applicationId}`,
    applicationId,
    "docker-compose.yml",
    `${name}-project`,
    "web",
    8080,
    `${applicationId}.lab`,
    "standard",
    1,
    "[]",
    "{\"SECRET_TOKEN\":\"super-secret\"}",
    1,
    null
  );

  db.prepare(
    `
      INSERT INTO routes (
        route_id,
        application_id,
        hostname,
        upstream_container,
        upstream_port,
        enabled,
        released_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(`route-${applicationId}`, applicationId, `${applicationId}.lab`, "web", 8080, 1, null);
}

function createOperationService(db: Database.Database): OperationService {
  return new OperationService({
    db,
    now: () => "2026-06-20T10:00:00.000Z",
    eventBus: new InMemoryOperationEventBus(),
    autoStart: false
  });
}

test("creates an operation with initial steps and blocks a second active operation", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  insertApplication(db, "app-1");

  const service = createOperationService(db);
  const created = await service.createOperation({
    applicationId: "app-1",
    type: "deploy",
    parameters: { rebuild: true }
  });

  assert.equal(created.status, "queued");
  assert.equal(created.canCancel, true);
  assert.equal(created.canRetry, false);
  assert.deepEqual(created.parameters, { rebuild: true });

  const detail = await service.getOperationDetail(created.operationId);
  assert.deepEqual(
    detail.steps.map((step) => step.name),
    ["resolveRepository", "cloneOrPullRepository", "inspectCompose", "dockerComposeUpWithBuild", "syncInfrastructure"]
  );

  await assert.rejects(
    async () => {
      await service.createOperation({
        applicationId: "app-1",
        type: "restart",
        parameters: {}
      });
    },
    (error: unknown) =>
      error instanceof OperationConflictError
      && error.code === "APPLICATION_OPERATION_CONFLICT"
      && error.details.activeOperationId === created.operationId
  );
});

test("cancels a queued operation and marks queued steps as skipped", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  insertApplication(db, "app-2");

  const service = createOperationService(db);
  const created = await service.createOperation({
    applicationId: "app-2",
    type: "delete",
    parameters: { mode: "configOnly" }
  });

  const cancelled = await service.cancelOperation(created.operationId);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.canCancel, false);
  assert.equal(cancelled.finishedAt, "2026-06-20T10:00:00.000Z");

  const detail = await service.getOperationDetail(created.operationId);
  assert.ok(detail.steps.every((step) => step.status === "skipped"));
});

test("retries a failed operation as a new queued operation and marks startup leftovers interrupted", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  insertApplication(db, "app-3");
  insertApplication(db, "app-4", "demo-app-4");

  const service = createOperationService(db);
  const failed = await service.createOperation({
    applicationId: "app-3",
    type: "update",
    parameters: { targetRevision: "abc123" }
  });

  db.prepare(
    `
      UPDATE operations
      SET status = 'failed',
          error_code = 'DEPLOYMENT_FAILED',
          error_message = 'failed once',
          finished_at = ?,
          updated_at = ?
      WHERE operation_id = ?
    `
  ).run("2026-06-20T10:10:00.000Z", "2026-06-20T10:10:00.000Z", failed.operationId);

  const retried = await service.retryOperation(failed.operationId);
  assert.equal(retried.status, "queued");
  assert.equal(retried.retryOfOperationId, failed.operationId);
  assert.deepEqual(retried.parameters, { targetRevision: "abc123" });

  const queued = await service.createOperation({
    applicationId: "app-4",
    type: "restart",
    parameters: {}
  });
  db.prepare(
    `
      UPDATE operations
      SET status = 'running',
          started_at = ?,
          updated_at = ?
      WHERE operation_id = ?
    `
  ).run("2026-06-20T10:05:00.000Z", "2026-06-20T10:05:00.000Z", queued.operationId);

  const interrupted = await service.markIncompleteOperationsAsInterrupted();
  assert.equal(interrupted.length, 2);

  const retriedDetail = await service.getOperationDetail(retried.operationId);
  assert.equal(retriedDetail.status, "interrupted");
  assert.equal(retriedDetail.error?.code, "OPERATION_INTERRUPTED");
  assert.equal(retriedDetail.canRetry, true);

  const runningDetail = await service.getOperationDetail(queued.operationId);
  assert.equal(runningDetail.status, "interrupted");
  assert.equal(runningDetail.error?.details?.reason, "backend_restart");
});

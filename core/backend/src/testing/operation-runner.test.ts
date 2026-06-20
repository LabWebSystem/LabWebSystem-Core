import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { applySchema } from "../lib/schema.js";
import { InMemoryOperationEventBus } from "../modules/operations/operation-events.js";
import { OperationRunner } from "../modules/operations/operation-runner.js";
import { OperationService } from "../modules/operations/operation.service.js";

function insertApplication(db: Database.Database, applicationId: string, name: string): void {
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
    `${name}.lab`,
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
  ).run(`route-${applicationId}`, applicationId, `${name}.lab`, "web", 8080, 1, null);
}

test("executes a dry-run deploy operation to completion with redacted logs", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  insertApplication(db, "app-runner", "runner-app");

  const eventBus = new InMemoryOperationEventBus();
  const service = new OperationService({
    db,
    now: () => "2026-06-20T13:00:00.000Z",
    eventBus,
    autoStart: false
  });
  const runner = new OperationRunner({
    db,
    now: () => "2026-06-20T13:00:00.000Z",
    eventBus,
    executionMode: "dry-run"
  });

  const created = await service.createOperation({
    applicationId: "app-runner",
    type: "deploy",
    parameters: {
      rebuild: true
    }
  });

  await runner.executeOperation(created.operationId);

  const detail = await service.getOperationDetail(created.operationId);
  assert.equal(detail.status, "succeeded");
  assert.equal(detail.currentStepName, "syncInfrastructure");
  assert.ok(detail.steps.every((step) => step.status === "succeeded"));

  const logs = await service.listOperationLogs({
    operationId: created.operationId,
    tail: 100
  });
  assert.ok(logs.items.length > 0);
  assert.ok(logs.items.every((item) => !item.line.includes("super-secret")));

  const application = db
    .prepare("SELECT status FROM applications WHERE application_id = ?")
    .get("app-runner") as { status: string } | undefined;
  assert.equal(application?.status, "Running");
});

test("executes a configOnly delete operation as a logical delete", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  insertApplication(db, "app-delete", "delete-app");

  const eventBus = new InMemoryOperationEventBus();
  const service = new OperationService({
    db,
    now: () => "2026-06-20T14:00:00.000Z",
    eventBus,
    autoStart: false
  });
  const runner = new OperationRunner({
    db,
    now: () => "2026-06-20T14:00:00.000Z",
    eventBus,
    executionMode: "dry-run"
  });

  const created = await service.createOperation({
    applicationId: "app-delete",
    type: "delete",
    parameters: {
      mode: "configOnly"
    }
  });

  await runner.executeOperation(created.operationId);

  const detail = await service.getOperationDetail(created.operationId);
  assert.equal(detail.status, "succeeded");

  const application = db
    .prepare("SELECT status, deleted_at FROM applications WHERE application_id = ?")
    .get("app-delete") as { status: string; deleted_at: string | null } | undefined;
  const deployment = db
    .prepare("SELECT released_at FROM deployments WHERE application_id = ?")
    .get("app-delete") as { released_at: string | null } | undefined;
  const route = db
    .prepare("SELECT enabled, released_at FROM routes WHERE application_id = ?")
    .get("app-delete") as { enabled: number; released_at: string | null } | undefined;

  assert.equal(application?.status, "Deleted");
  assert.equal(typeof application?.deleted_at, "string");
  assert.equal(typeof deployment?.released_at, "string");
  assert.equal(route?.enabled, 0);
  assert.equal(typeof route?.released_at, "string");
});

import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { applySchema } from "../lib/schema.js";
import { createApplicationsApiRouter } from "../modules/applications/application.routes.js";
import { InMemoryOperationEventBus } from "../modules/operations/operation-events.js";
import { createOperationsApiRouter } from "../modules/operations/operation.routes.js";
import { OperationService } from "../modules/operations/operation.service.js";

function insertApplication(db: Database.Database): void {
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
    "app-route",
    "route-app",
    "route demo",
    "https://github.com/example/route-app.git",
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
    "dep-route",
    "app-route",
    "docker-compose.yml",
    "route-project",
    "web",
    8080,
    "route.lab",
    "standard",
    1,
    "[]",
    "{}",
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
  ).run("route-1", "app-route", "route.lab", "web", 8080, 1, null);
}

function createApp(db: Database.Database): { app: Hono; operationService: OperationService } {
  const operationService = new OperationService({
    db,
    now: () => "2026-06-20T12:00:00.000Z",
    eventBus: new InMemoryOperationEventBus(),
    autoStart: false
  });

  const app = new Hono();
  app.route("/api/applications", createApplicationsApiRouter({ db, operationService }));
  app.route("/api/operations", createOperationsApiRouter({ operationService }));

  return { app, operationService };
}

test("creates operations through the application endpoint and lists logs with tail/after semantics", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  insertApplication(db);

  const { app } = createApp(db);
  const createResponse = await app.request("/api/applications/app-route/operations", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      type: "delete",
      parameters: {
        mode: "configOnly"
      }
    })
  });

  assert.equal(createResponse.status, 202);
  const created = (await createResponse.json()) as { operationId: string; type: string; parameters: { mode: string } };
  assert.equal(created.type, "delete");
  assert.equal(created.parameters.mode, "configOnly");

  db.prepare(
    `
      INSERT INTO operation_logs (
        operation_id,
        step_id,
        sequence,
        stream,
        line,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(created.operationId, null, 1, "system", "first", "2026-06-20T12:00:01.000Z");
  db.prepare(
    `
      INSERT INTO operation_logs (
        operation_id,
        step_id,
        sequence,
        stream,
        line,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(created.operationId, null, 2, "stdout", "second", "2026-06-20T12:00:02.000Z");
  db.prepare(
    `
      INSERT INTO operation_logs (
        operation_id,
        step_id,
        sequence,
        stream,
        line,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(created.operationId, null, 3, "stderr", "third", "2026-06-20T12:00:03.000Z");

  const tailResponse = await app.request(`/api/operations/${created.operationId}/logs?tail=2`);
  assert.equal(tailResponse.status, 200);
  const tailBody = (await tailResponse.json()) as {
    logsAvailable: boolean;
    items: Array<{ sequence: number; line: string }>;
    nextAfter: number | null;
    hasMore: boolean;
  };

  assert.equal(tailBody.logsAvailable, true);
  assert.deepEqual(
    tailBody.items.map((item) => item.sequence),
    [2, 3]
  );
  assert.equal(tailBody.nextAfter, 3);
  assert.equal(tailBody.hasMore, false);

  const afterResponse = await app.request(`/api/operations/${created.operationId}/logs?after=1&limit=1`);
  assert.equal(afterResponse.status, 200);
  const afterBody = (await afterResponse.json()) as {
    items: Array<{ sequence: number; line: string; stream: string; stepId: string | null }>;
    nextAfter: number | null;
    hasMore: boolean;
  };

  assert.deepEqual(
    afterBody.items.map((item) => ({
      sequence: item.sequence,
      line: item.line,
      stream: item.stream,
      stepId: item.stepId
    })),
    [{ sequence: 2, line: "second", stream: "stdout", stepId: null }]
  );
  assert.equal(afterBody.nextAfter, 2);
  assert.equal(afterBody.hasMore, true);
});

test("rejects removed legacy operation endpoints with a standard error response", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  insertApplication(db);

  const { app } = createApp(db);
  const response = await app.request("/api/applications/app-route/restart", {
    method: "POST"
  });

  assert.equal(response.status, 404);
  const body = (await response.json()) as {
    error: {
      code: string;
      message: string;
      requestId: string;
    };
  };

  assert.equal(body.error.code, "ENDPOINT_REMOVED");
  assert.match(body.error.message, /operations/i);
  assert.equal(typeof body.error.requestId, "string");
});

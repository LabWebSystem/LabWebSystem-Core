import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { applySchema } from "../lib/schema.js";
import { createApplicationsApiRouter } from "../modules/applications/application.routes.js";
import { InMemoryOperationEventBus } from "../modules/operations/operation-events.js";
import { createOperationsApiRouter } from "../modules/operations/operation.routes.js";
import { OperationService } from "../modules/operations/operation.service.js";

function createApp(db: Database.Database): Hono {
  const operationService = new OperationService({
    db,
    now: () => "2026-06-20T08:00:00.000Z",
    eventBus: new InMemoryOperationEventBus(),
    autoStart: false
  });

  const app = new Hono();
  app.route("/api/applications", createApplicationsApiRouter({ db, operationService }));
  app.route("/api/operations", createOperationsApiRouter({ operationService }));
  return app;
}

test("creates applications without auto-enqueuing deploy operations and filters deleted applications from the list", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);

  const app = createApp(db);
  const createResponse = await app.request("/api/applications", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: "demo-app",
      description: "demo",
      repositoryUrl: "https://github.com/example/demo-app.git",
      defaultBranch: "main",
      composePath: "docker-compose.yml",
      publicServiceName: "web",
      publicPort: 8080,
      hostname: "demo.lab",
      mode: "standard",
      keepVolumesOnRebuild: true,
      deviceRequirements: [],
      envOverrides: {
        APP_TOKEN: "secret-token"
      }
    })
  });

  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as {
    applicationId: string;
    deploymentId: string;
    routeId: string;
    message: string;
  };
  assert.equal(typeof created.applicationId, "string");
  assert.match(created.message, /registered/i);

  const operationCount = db
    .prepare("SELECT COUNT(*) AS count FROM operations WHERE application_id = ?")
    .get(created.applicationId) as { count: number } | undefined;
  assert.equal(operationCount?.count ?? 0, 0);

  db.prepare(
    `
      UPDATE applications
      SET status = 'Deleted',
          deleted_at = ?,
          updated_at = ?
      WHERE application_id = ?
    `
  ).run("2026-06-20T08:10:00.000Z", "2026-06-20T08:10:00.000Z", created.applicationId);
  db.prepare("UPDATE deployments SET released_at = ? WHERE application_id = ?").run(
    "2026-06-20T08:10:00.000Z",
    created.applicationId
  );
  db.prepare("UPDATE routes SET enabled = 0, released_at = ? WHERE application_id = ?").run(
    "2026-06-20T08:10:00.000Z",
    created.applicationId
  );

  const listResponse = await app.request("/api/applications");
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as { applications: Array<{ application_id: string }> };
  assert.deepEqual(listBody.applications, []);
});

test("updates application and deployment settings through the new canonical endpoints", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);

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
    "app-settings",
    "settings-app",
    "before",
    "https://github.com/example/settings-app.git",
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
    "dep-settings",
    "app-settings",
    "docker-compose.yml",
    "settings-app-project",
    "web",
    8080,
    "settings.lab",
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
  ).run("route-settings", "app-settings", "settings.lab", "web", 8080, 1, null);

  const app = createApp(db);

  const patchApplication = await app.request("/api/applications/app-settings", {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: "settings-app-renamed",
      description: "after",
      defaultBranch: "release"
    })
  });
  assert.equal(patchApplication.status, 200);

  const patchDeployment = await app.request("/api/applications/app-settings/deployment", {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      composePath: "compose.prod.yml",
      publicServiceName: "api",
      publicPort: 9000,
      hostname: "settings-new.lab",
      keepVolumesOnRebuild: false,
      envOverrides: {
        LOG_LEVEL: "debug"
      }
    })
  });
  assert.equal(patchDeployment.status, 200);

  const detailResponse = await app.request("/api/applications/app-settings");
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()) as {
    application: {
      name: string;
      description: string;
      default_branch: string;
    };
    deployment: {
      compose_path: string;
      public_service_name: string;
      public_port: number;
      hostname: string;
      keep_volumes_on_rebuild: boolean;
      env_overrides: Record<string, string>;
    };
  };

  assert.equal(detail.application.name, "settings-app-renamed");
  assert.equal(detail.application.description, "after");
  assert.equal(detail.application.default_branch, "release");
  assert.equal(detail.deployment.compose_path, "compose.prod.yml");
  assert.equal(detail.deployment.public_service_name, "api");
  assert.equal(detail.deployment.public_port, 9000);
  assert.equal(detail.deployment.hostname, "settings-new.lab");
  assert.equal(detail.deployment.keep_volumes_on_rebuild, false);
  assert.deepEqual(detail.deployment.env_overrides, { LOG_LEVEL: "debug" });
});

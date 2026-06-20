import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { applySchema } from "../lib/schema.js";

function createLegacySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE applications (
      application_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      repository_url TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      current_commit TEXT,
      previous_commit TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE deployments (
      deployment_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL UNIQUE,
      compose_path TEXT NOT NULL,
      compose_project_name TEXT,
      public_service_name TEXT NOT NULL,
      public_port INTEGER NOT NULL,
      hostname TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL,
      keep_volumes_on_rebuild INTEGER NOT NULL DEFAULT 1,
      device_requirements TEXT NOT NULL DEFAULT '[]',
      env_overrides TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );

    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      hostname TEXT NOT NULL,
      upstream_container TEXT,
      upstream_port INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(application_id, hostname),
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );

    CREATE TABLE jobs (
      job_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      message TEXT,
      request_payload TEXT NOT NULL DEFAULT '{}',
      related_application_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(related_application_id) REFERENCES applications(application_id) ON DELETE SET NULL
    );

    CREATE TABLE system_events (
      event_id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      application_id TEXT,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE SET NULL
    );

    CREATE TABLE update_info (
      application_id TEXT PRIMARY KEY,
      current_commit TEXT,
      latest_remote_commit TEXT,
      has_update INTEGER NOT NULL DEFAULT 0,
      checked_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );

    CREATE TABLE dashboard_layouts (
      dashboard_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(dashboard_id, user_id)
    );

    CREATE INDEX idx_applications_status ON applications(status);
    CREATE INDEX idx_jobs_status_created_at ON jobs(status, created_at DESC);
  `);
}

test("migrates legacy jobs into operations and rebuilds active-only uniqueness constraints", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createLegacySchema(db);

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
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    "app-legacy",
    "demo-app",
    "legacy app",
    "https://github.com/example/demo-app.git",
    "main",
    null,
    null,
    "Running",
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
        enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    "dep-legacy",
    "app-legacy",
    "docker-compose.yml",
    "demo-app",
    "web",
    8080,
    "demo.lab",
    "standard",
    1,
    "[]",
    "{}",
    1
  );

  db.prepare(
    `
      INSERT INTO routes (
        route_id,
        application_id,
        hostname,
        upstream_container,
        upstream_port,
        enabled
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run("route-legacy", "app-legacy", "demo.lab", "web", 8080, 1);

  db.prepare(
    `
      INSERT INTO jobs (
        job_id,
        type,
        status,
        started_at,
        finished_at,
        message,
        request_payload,
        related_application_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    "job-legacy",
    "deploy",
    "queued",
    null,
    null,
    "legacy deploy",
    "{\"rebuild\":true}",
    "app-legacy",
    "2026-06-20T00:10:00.000Z"
  );

  applySchema(db);

  const jobsTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'jobs'").get();
  assert.equal(jobsTable, undefined);

  const migrated = db
    .prepare(
      `
        SELECT operation_id, application_id, type, status, parameters, created_at
        FROM operations
        WHERE operation_id = ?
      `
    )
    .get("job-legacy") as
    | {
        operation_id: string;
        application_id: string;
        type: string;
        status: string;
        parameters: string;
        created_at: string;
      }
    | undefined;

  assert.deepEqual(migrated, {
    operation_id: "job-legacy",
    application_id: "app-legacy",
    type: "deploy",
    status: "queued",
    parameters: "{\"rebuild\":true}",
    created_at: "2026-06-20T00:10:00.000Z"
  });

  const routeColumns = db.prepare("PRAGMA table_info(routes)").all() as Array<{ name: string }>;
  const appColumns = db.prepare("PRAGMA table_info(applications)").all() as Array<{ name: string }>;
  const deploymentColumns = db.prepare("PRAGMA table_info(deployments)").all() as Array<{ name: string }>;

  assert.ok(appColumns.some((column) => column.name === "deleted_at"));
  assert.ok(deploymentColumns.some((column) => column.name === "released_at"));
  assert.ok(routeColumns.some((column) => column.name === "released_at"));

  db.prepare(
    `
      UPDATE applications
      SET status = 'Deleted',
          deleted_at = ?,
          updated_at = ?
      WHERE application_id = ?
    `
  ).run("2026-06-20T01:00:00.000Z", "2026-06-20T01:00:00.000Z", "app-legacy");
  db.prepare("UPDATE deployments SET released_at = ? WHERE application_id = ?").run(
    "2026-06-20T01:00:00.000Z",
    "app-legacy"
  );
  db.prepare("UPDATE routes SET enabled = 0, released_at = ? WHERE application_id = ?").run(
    "2026-06-20T01:00:00.000Z",
    "app-legacy"
  );

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
    "app-reused",
    "demo-app",
    "replacement app",
    "https://github.com/example/demo-app.git",
    "main",
    null,
    null,
    "Registered",
    null,
    "2026-06-20T02:00:00.000Z",
    "2026-06-20T02:00:00.000Z"
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
    "dep-reused",
    "app-reused",
    "docker-compose.yml",
    "demo-app-reused",
    "web",
    8080,
    "demo.lab",
    "standard",
    1,
    "[]",
    "{}",
    1,
    null
  );

  db.prepare(
    `
      INSERT INTO operations (
        operation_id,
        application_id,
        type,
        status,
        parameters,
        logs_available,
        created_at,
        updated_at,
        started_at,
        finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    "op-active-1",
    "app-reused",
    "deploy",
    "queued",
    "{}",
    1,
    "2026-06-20T02:01:00.000Z",
    "2026-06-20T02:01:00.000Z",
    null,
    null
  );

  assert.throws(
    () => {
      db.prepare(
        `
          INSERT INTO operations (
            operation_id,
            application_id,
            type,
            status,
            parameters,
            logs_available,
            created_at,
            updated_at,
            started_at,
            finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        "op-active-2",
        "app-reused",
        "restart",
        "running",
        "{}",
        1,
        "2026-06-20T02:02:00.000Z",
        "2026-06-20T02:02:00.000Z",
        "2026-06-20T02:02:00.000Z",
        null
      );
    },
    /UNIQUE|idx_operations_one_active_per_application/
  );
});

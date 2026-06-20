import type Database from "better-sqlite3";

const applicationStatusValues = [
  "Draft",
  "Registered",
  "Cloning",
  "Build Pending",
  "Deploying",
  "Running",
  "Degraded",
  "Stopped",
  "Failed",
  "Rebuilding",
  "Deleting",
  "Deleted"
] as const;

const operationStatusValues = ["queued", "running", "succeeded", "failed", "cancelled", "interrupted"] as const;
const operationTypeValues = ["deploy", "restart", "stop", "resume", "rebuild", "update-check", "update", "rollback", "delete"] as const;
const operationStepStatusValues = ["pending", "running", "succeeded", "failed", "skipped"] as const;
const operationLogStreamValues = ["stdout", "stderr", "system"] as const;

function quoteSql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildCheckList(values: readonly string[]): string {
  return values.map((value) => quoteSql(value)).join(", ");
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

function indexExists(db: Database.Database, indexName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(indexName) as { name: string } | undefined;
  return Boolean(row);
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  if (!tableExists(db, tableName)) {
    return false;
  }

  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function createApplicationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE applications (
      application_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      repository_url TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      current_commit TEXT,
      previous_commit TEXT,
      status TEXT NOT NULL CHECK (status IN (${buildCheckList(applicationStatusValues)})),
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_applications_name_active
    ON applications(name)
    WHERE deleted_at IS NULL;
    CREATE INDEX idx_applications_status ON applications(status);
    CREATE INDEX idx_applications_deleted_at ON applications(deleted_at);
  `);
}

function rebuildApplicationsTable(db: Database.Database): void {
  const hasDeletedAt = columnExists(db, "applications", "deleted_at");
  db.exec(`
    ALTER TABLE applications RENAME TO applications__legacy;
    CREATE TABLE applications (
      application_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      repository_url TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      current_commit TEXT,
      previous_commit TEXT,
      status TEXT NOT NULL CHECK (status IN (${buildCheckList(applicationStatusValues)})),
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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
    )
    SELECT
      application_id,
      name,
      description,
      repository_url,
      default_branch,
      current_commit,
      previous_commit,
      status,
      ${hasDeletedAt ? "deleted_at" : "NULL"},
      created_at,
      updated_at
    FROM applications__legacy;
    DROP TABLE applications__legacy;
    CREATE UNIQUE INDEX idx_applications_name_active
    ON applications(name)
    WHERE deleted_at IS NULL;
    CREATE INDEX idx_applications_status ON applications(status);
    CREATE INDEX idx_applications_deleted_at ON applications(deleted_at);
  `);
}

function ensureApplicationsTable(db: Database.Database): void {
  if (!tableExists(db, "applications")) {
    createApplicationsTable(db);
    return;
  }

  if (!columnExists(db, "applications", "deleted_at") || !indexExists(db, "idx_applications_name_active")) {
    rebuildApplicationsTable(db);
  } else {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
      CREATE INDEX IF NOT EXISTS idx_applications_deleted_at ON applications(deleted_at);
    `);
  }
}

function createDeploymentsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE deployments (
      deployment_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL UNIQUE,
      compose_path TEXT NOT NULL,
      compose_project_name TEXT,
      public_service_name TEXT NOT NULL,
      public_port INTEGER NOT NULL,
      hostname TEXT NOT NULL,
      mode TEXT NOT NULL,
      keep_volumes_on_rebuild INTEGER NOT NULL DEFAULT 1,
      device_requirements TEXT NOT NULL DEFAULT '[]',
      env_overrides TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      released_at TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX idx_deployments_hostname_active
    ON deployments(hostname)
    WHERE released_at IS NULL;
    CREATE INDEX idx_deployments_application_id ON deployments(application_id);
    CREATE INDEX idx_deployments_released_at ON deployments(released_at);
  `);
}

function rebuildDeploymentsTable(db: Database.Database): void {
  const hasReleasedAt = columnExists(db, "deployments", "released_at");
  db.exec(`
    ALTER TABLE deployments RENAME TO deployments__legacy;
    CREATE TABLE deployments (
      deployment_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL UNIQUE,
      compose_path TEXT NOT NULL,
      compose_project_name TEXT,
      public_service_name TEXT NOT NULL,
      public_port INTEGER NOT NULL,
      hostname TEXT NOT NULL,
      mode TEXT NOT NULL,
      keep_volumes_on_rebuild INTEGER NOT NULL DEFAULT 1,
      device_requirements TEXT NOT NULL DEFAULT '[]',
      env_overrides TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      released_at TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );
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
    )
    SELECT
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
      ${hasReleasedAt ? "released_at" : "NULL"}
    FROM deployments__legacy;
    DROP TABLE deployments__legacy;
    CREATE UNIQUE INDEX idx_deployments_hostname_active
    ON deployments(hostname)
    WHERE released_at IS NULL;
    CREATE INDEX idx_deployments_application_id ON deployments(application_id);
    CREATE INDEX idx_deployments_released_at ON deployments(released_at);
  `);
}

function ensureDeploymentsTable(db: Database.Database): void {
  if (!tableExists(db, "deployments")) {
    createDeploymentsTable(db);
    return;
  }

  if (!columnExists(db, "deployments", "released_at") || !indexExists(db, "idx_deployments_hostname_active")) {
    rebuildDeploymentsTable(db);
  } else {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_deployments_application_id ON deployments(application_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_released_at ON deployments(released_at);
    `);
  }
}

function createRoutesTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      hostname TEXT NOT NULL,
      upstream_container TEXT,
      upstream_port INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      released_at TEXT,
      UNIQUE(application_id, hostname),
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );
    CREATE INDEX idx_routes_application_id ON routes(application_id);
    CREATE INDEX idx_routes_enabled ON routes(enabled);
    CREATE INDEX idx_routes_released_at ON routes(released_at);
  `);
}

function rebuildRoutesTable(db: Database.Database): void {
  const hasReleasedAt = columnExists(db, "routes", "released_at");
  db.exec(`
    ALTER TABLE routes RENAME TO routes__legacy;
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      hostname TEXT NOT NULL,
      upstream_container TEXT,
      upstream_port INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      released_at TEXT,
      UNIQUE(application_id, hostname),
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );
    INSERT INTO routes (
      route_id,
      application_id,
      hostname,
      upstream_container,
      upstream_port,
      enabled,
      released_at
    )
    SELECT
      route_id,
      application_id,
      hostname,
      upstream_container,
      upstream_port,
      enabled,
      ${hasReleasedAt ? "released_at" : "NULL"}
    FROM routes__legacy;
    DROP TABLE routes__legacy;
    CREATE INDEX idx_routes_application_id ON routes(application_id);
    CREATE INDEX idx_routes_enabled ON routes(enabled);
    CREATE INDEX idx_routes_released_at ON routes(released_at);
  `);
}

function ensureRoutesTable(db: Database.Database): void {
  if (!tableExists(db, "routes")) {
    createRoutesTable(db);
    return;
  }

  if (!columnExists(db, "routes", "released_at")) {
    rebuildRoutesTable(db);
  } else {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_routes_application_id ON routes(application_id);
      CREATE INDEX IF NOT EXISTS idx_routes_enabled ON routes(enabled);
      CREATE INDEX IF NOT EXISTS idx_routes_released_at ON routes(released_at);
    `);
  }
}

function ensureContainerInstancesTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS container_instances (
      container_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      runtime_name TEXT NOT NULL,
      health_state TEXT NOT NULL,
      restart_count INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_container_instances_application_id ON container_instances(application_id);
  `);
}

function ensureSystemEventsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_events (
      event_id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      application_id TEXT,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);
  `);
}

function ensureUpdateInfoTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS update_info (
      application_id TEXT PRIMARY KEY,
      current_commit TEXT,
      latest_remote_commit TEXT,
      has_update INTEGER NOT NULL DEFAULT 0,
      checked_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
    );
  `);
}

function ensureOperationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operations (
      operation_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN (${buildCheckList(operationTypeValues)})),
      status TEXT NOT NULL CHECK (status IN (${buildCheckList(operationStatusValues)})),
      current_step_id TEXT,
      current_step_name TEXT,
      current_step_order INTEGER,
      parameters TEXT NOT NULL DEFAULT '{}',
      result TEXT,
      error_code TEXT,
      error_message TEXT,
      error_details TEXT,
      retry_of_operation_id TEXT,
      logs_available INTEGER NOT NULL DEFAULT 1 CHECK (logs_available IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE RESTRICT,
      FOREIGN KEY(retry_of_operation_id) REFERENCES operations(operation_id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_operations_application_created_at ON operations(application_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operations_one_active_per_application
    ON operations(application_id)
    WHERE status IN ('queued', 'running');
  `);
}

function ensureOperationStepsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_steps (
      step_id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN (${buildCheckList(operationStepStatusValues)})),
      started_at TEXT,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      message TEXT,
      error_code TEXT,
      details TEXT,
      UNIQUE(operation_id, step_order),
      FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_operation_steps_operation_order
    ON operation_steps(operation_id, step_order);
  `);
}

function ensureOperationLogsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT NOT NULL,
      step_id TEXT,
      sequence INTEGER NOT NULL,
      stream TEXT NOT NULL CHECK (stream IN (${buildCheckList(operationLogStreamValues)})),
      line TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(operation_id, sequence),
      FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE,
      FOREIGN KEY(step_id) REFERENCES operation_steps(step_id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_sequence
    ON operation_logs(operation_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_step
    ON operation_logs(operation_id, step_id);
  `);
}

function migrateJobsToOperations(db: Database.Database): void {
  if (!tableExists(db, "jobs")) {
    return;
  }

  db.exec(`
    INSERT OR IGNORE INTO operations (
      operation_id,
      application_id,
      type,
      status,
      current_step_id,
      current_step_name,
      current_step_order,
      parameters,
      result,
      error_code,
      error_message,
      error_details,
      retry_of_operation_id,
      logs_available,
      created_at,
      updated_at,
      started_at,
      finished_at
    )
    SELECT
      job_id,
      related_application_id,
      type,
      CASE
        WHEN status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled') THEN status
        ELSE 'failed'
      END,
      NULL,
      NULL,
      NULL,
      request_payload,
      NULL,
      CASE
        WHEN status = 'failed' THEN 'LEGACY_JOB_FAILURE'
        WHEN status = 'cancelled' THEN 'LEGACY_JOB_CANCELLED'
        ELSE NULL
      END,
      CASE
        WHEN status IN ('failed', 'cancelled') THEN message
        ELSE NULL
      END,
      NULL,
      NULL,
      1,
      created_at,
      COALESCE(finished_at, started_at, created_at),
      started_at,
      finished_at
    FROM jobs
    WHERE related_application_id IS NOT NULL;

    DROP TABLE jobs;
  `);
}

function ensureDashboardLayoutsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dashboard_layouts (
      dashboard_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(dashboard_id, user_id)
    );
  `);
}

export function applySchema(db: Database.Database): void {
  db.exec("PRAGMA foreign_keys = OFF");

  try {
    ensureApplicationsTable(db);
    ensureDeploymentsTable(db);
    ensureRoutesTable(db);
    ensureContainerInstancesTable(db);
    ensureSystemEventsTable(db);
    ensureUpdateInfoTable(db);
    ensureOperationsTable(db);
    ensureOperationStepsTable(db);
    ensureOperationLogsTable(db);
    migrateJobsToOperations(db);
    ensureDashboardLayoutsTable(db);
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

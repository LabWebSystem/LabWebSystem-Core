import { nanoid } from "nanoid";
import type Database from "better-sqlite3";

function parseJsonList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

export class ApplicationRepository {
  constructor(private readonly db: Database.Database) {}

  createApplication(
    input: {
      name: string;
      description: string;
      repositoryUrl: string;
      defaultBranch: string;
      composePath: string;
      publicServiceName: string;
      publicPort: number;
      hostname: string;
      mode: "standard" | "headless";
      keepVolumesOnRebuild: boolean;
      deviceRequirements: string[];
      envOverrides: Record<string, string>;
    },
    timestamp: string
  ) {
    const applicationId = nanoid();
    const deploymentId = nanoid();
    const routeId = nanoid();
    const tx = this.db.transaction(() => {
      this.db.prepare(
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
        input.name,
        input.description,
        input.repositoryUrl,
        input.defaultBranch,
        null,
        null,
        "Registered",
        null,
        timestamp,
        timestamp
      );

      this.db.prepare(
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
        deploymentId,
        applicationId,
        input.composePath,
        `${input.name}-${applicationId.slice(0, 6)}`,
        input.publicServiceName,
        input.publicPort,
        input.hostname,
        input.mode,
        input.keepVolumesOnRebuild ? 1 : 0,
        JSON.stringify(input.deviceRequirements),
        JSON.stringify(input.envOverrides),
        1,
        null
      );

      this.db.prepare(
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
      ).run(routeId, applicationId, input.hostname, input.publicServiceName, input.publicPort, 1, null);
    });

    tx();

    return {
      applicationId,
      deploymentId,
      routeId
    };
  }

  listApplications(): Array<Record<string, unknown>> {
    const rows = this.db.prepare(
      `
        SELECT
          a.application_id,
          a.name,
          a.description,
          a.repository_url,
          a.default_branch,
          a.current_commit,
          a.previous_commit,
          a.status,
          a.created_at,
          a.updated_at,
          d.hostname,
          d.public_service_name,
          d.public_port,
          d.mode,
          d.keep_volumes_on_rebuild,
          d.device_requirements,
          d.env_overrides,
          d.enabled,
          u.latest_remote_commit,
          u.has_update,
          u.checked_at
        FROM applications a
        LEFT JOIN deployments d ON d.application_id = a.application_id
        LEFT JOIN update_info u ON u.application_id = a.application_id
        WHERE a.deleted_at IS NULL
        ORDER BY a.created_at DESC
      `
    ).all() as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      ...row,
      keep_volumes_on_rebuild: Boolean(row.keep_volumes_on_rebuild),
      device_requirements: parseJsonList(String(row.device_requirements ?? "[]")),
      env_overrides: parseJsonRecord(String(row.env_overrides ?? "{}")),
      enabled: Boolean(row.enabled),
      has_update: Boolean(row.has_update)
    }));
  }

  getApplication(applicationId: string): Record<string, unknown> | null {
    const row = this.db.prepare(
      `
        SELECT
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
        FROM applications
        WHERE application_id = ?
          AND deleted_at IS NULL
      `
    ).get(applicationId) as Record<string, unknown> | undefined;

    return row ?? null;
  }

  getDeployment(applicationId: string): Record<string, unknown> | null {
    const row = this.db.prepare(
      `
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
          released_at
        FROM deployments
        WHERE application_id = ?
      `
    ).get(applicationId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return {
      ...row,
      keep_volumes_on_rebuild: Boolean(row.keep_volumes_on_rebuild),
      device_requirements: parseJsonList(String(row.device_requirements ?? "[]")),
      env_overrides: parseJsonRecord(String(row.env_overrides ?? "{}")),
      enabled: Boolean(row.enabled)
    };
  }

  getApplicationDetail(applicationId: string): {
    application: Record<string, unknown>;
    deployment: Record<string, unknown> | null;
    routes: Array<Record<string, unknown>>;
    containers: unknown[];
    updateInfo: Record<string, unknown> | null;
    events: unknown[];
    operations: unknown[];
  } | null {
    const application = this.getApplication(applicationId);
    if (!application) {
      return null;
    }

    const deployment = this.getDeployment(applicationId);
    const routes = this.db.prepare(
      `
        SELECT route_id, hostname, upstream_container, upstream_port, enabled, released_at
        FROM routes
        WHERE application_id = ?
        ORDER BY hostname ASC
      `
    ).all(applicationId) as Array<Record<string, unknown>>;
    const containers = this.db.prepare(
      `
        SELECT container_id, service_name, runtime_name, health_state, restart_count, last_seen_at
        FROM container_instances
        WHERE application_id = ?
        ORDER BY service_name ASC
      `
    ).all(applicationId);
    const updateInfo = this.db.prepare(
      `
        SELECT current_commit, latest_remote_commit, has_update, checked_at
        FROM update_info
        WHERE application_id = ?
      `
    ).get(applicationId) as Record<string, unknown> | undefined;
    const events = this.db.prepare(
      `
        SELECT event_id, scope, application_id, level, title, message, created_at
        FROM system_events
        WHERE application_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `
    ).all(applicationId);
    const operations = this.db.prepare(
      `
        SELECT
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
        FROM operations
        WHERE application_id = ?
        ORDER BY created_at DESC
        LIMIT 40
      `
    ).all(applicationId);

    return {
      application,
      deployment,
      routes: routes.map((route) => ({
        ...route,
        enabled: Boolean(route.enabled)
      })),
      containers,
      updateInfo: updateInfo ? { ...updateInfo, has_update: Boolean(updateInfo.has_update) } : null,
      events,
      operations
    };
  }

  updateApplication(applicationId: string, input: Partial<{
    name: string;
    description: string;
    repositoryUrl: string;
    defaultBranch: string;
  }>, timestamp: string): void {
    const current = this.getApplication(applicationId);
    if (!current) {
      throw new Error("Application not found.");
    }

    this.db.prepare(
      `
        UPDATE applications
        SET name = ?,
            description = ?,
            repository_url = ?,
            default_branch = ?,
            updated_at = ?
        WHERE application_id = ?
      `
    ).run(
      input.name ?? String(current.name),
      input.description ?? String(current.description ?? ""),
      input.repositoryUrl ?? String(current.repository_url),
      input.defaultBranch ?? String(current.default_branch),
      timestamp,
      applicationId
    );
  }

  updateDeployment(
    applicationId: string,
    input: {
      composePath: string;
      publicServiceName: string;
      publicPort: number;
      hostname: string;
      keepVolumesOnRebuild: boolean;
      envOverrides: Record<string, string>;
    }
  ): void {
    const deployment = this.getDeployment(applicationId);
    if (!deployment) {
      throw new Error("Deployment not found.");
    }

    this.db.prepare(
      `
        UPDATE deployments
        SET compose_path = ?,
            public_service_name = ?,
            public_port = ?,
            hostname = ?,
            keep_volumes_on_rebuild = ?,
            env_overrides = ?
        WHERE application_id = ?
      `
    ).run(
      input.composePath,
      input.publicServiceName,
      input.publicPort,
      input.hostname,
      input.keepVolumesOnRebuild ? 1 : 0,
      JSON.stringify(input.envOverrides),
      applicationId
    );

    this.db.prepare(
      `
        UPDATE routes
        SET hostname = ?,
            upstream_container = ?,
            upstream_port = ?
        WHERE application_id = ?
      `
    ).run(input.hostname, input.publicServiceName, input.publicPort, applicationId);
  }
}

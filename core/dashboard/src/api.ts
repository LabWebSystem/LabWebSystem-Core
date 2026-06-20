import type {
  ApplicationComposeInspection,
  ApplicationDetail,
  ApplicationJob,
  DashboardLayoutDocument,
  DashboardLayoutResponse,
  DashboardMetrics,
  ApplicationListItem,
  ApplicationLogsResponse,
  CreateApplicationResponse,
  CreateApplicationPayload,
  DeleteMode,
  ImportComposeInspectResponse,
  ImportResolveResponse,
  RegistrationFixture,
  SystemEvent,
  SystemStatus,
  UpdateDeploymentPayload
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type OperationDto = {
  operationId: string;
  applicationId: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "interrupted";
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  parameters: Record<string, unknown>;
  error: { message: string } | null;
  canCancel: boolean;
  canRetry: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validateImportResolveResponse(payload: unknown): ImportResolveResponse {
  if (!isRecord(payload)) {
    throw new Error("URL解析レスポンスの形式が不正です。");
  }

  if (!isRecord(payload.manifest)) {
    throw new Error("labcore.app.yaml の情報がレスポンスに含まれていません。backend を再起動してもう一度試してください。");
  }

  const manifest = payload.manifest;
  if (
    !isRecord(manifest.app) ||
    !isRecord(manifest.deployment) ||
    !isRecord(manifest.exposure) ||
    !isRecord(manifest.devices) ||
    !isRecord(manifest.env) ||
    !hasString(payload.manifestPath) ||
    !hasString(payload.canonicalRepositoryUrl) ||
    !hasString(payload.resolvedBranch) ||
    !hasString(manifest.app.name) ||
    typeof manifest.app.description !== "string" ||
    !hasString(manifest.deployment.composePath) ||
    !hasString(manifest.exposure.service) ||
    typeof manifest.exposure.port !== "number" ||
    !hasString(manifest.exposure.hostname)
  ) {
    throw new Error("labcore.app.yaml のレスポンス形式が不正です。backend の更新状態を確認してください。");
  }

  return payload as ImportResolveResponse;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      isRecord(errorBody) && isRecord(errorBody.error) && typeof errorBody.error.message === "string"
        ? errorBody.error.message
        : isRecord(errorBody) && "message" in errorBody
          ? String(errorBody.message)
          : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function mapOperationToJob(operation: OperationDto): ApplicationJob {
  return {
    job_id: operation.operationId,
    type: operation.type,
    status: operation.status,
    started_at: operation.startedAt,
    finished_at: operation.finishedAt,
    message: operation.error?.message ?? null,
    related_application_id: operation.applicationId,
    created_at: operation.createdAt,
    request_payload: operation.parameters,
    retryable: operation.canRetry,
    cancellable: operation.canCancel,
    dismissible: false
  };
}

function mapOperationsToApplicationSummary(application: ApplicationListItem, operations: OperationDto[]): ApplicationListItem {
  const latest = operations[0] ?? null;
  const active = operations.find((operation) => operation.status === "queued" || operation.status === "running") ?? null;

  return {
    ...application,
    latest_job_type: latest?.type ?? null,
    latest_job_status: latest?.status ?? null,
    latest_job_message: latest?.error?.message ?? null,
    latest_job_created_at: latest?.createdAt ?? null,
    latest_job_started_at: latest?.startedAt ?? null,
    latest_job_finished_at: latest?.finishedAt ?? null,
    active_job_id: active?.operationId ?? null,
    active_job_type: active?.type ?? null,
    active_job_status: active && (active.status === "queued" || active.status === "running") ? active.status : null,
    active_job_message: active?.error?.message ?? null,
    active_job_created_at: active?.createdAt ?? null,
    active_job_started_at: active?.startedAt ?? null
  };
}

async function fetchOperationsForApplication(applicationId: string, limit = 20): Promise<OperationDto[]> {
  const response = await requestJson<{ operations: OperationDto[] }>(`/api/applications/${applicationId}/operations?limit=${limit}`);
  return response.operations;
}

async function createOperation(
  applicationId: string,
  payload: { type: string; parameters?: Record<string, unknown> }
): Promise<OperationDto> {
  return requestJson<OperationDto>(`/api/applications/${applicationId}/operations`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function toDeleteOperationMode(mode: DeleteMode): "configOnly" | "sourceAndConfig" | "full" {
  switch (mode) {
    case "config_only":
      return "configOnly";
    case "source_and_config":
      return "sourceAndConfig";
    case "full":
      return "full";
  }
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return requestJson<SystemStatus>("/api/system/status");
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  return requestJson<DashboardMetrics>("/api/system/metrics");
}

export async function fetchDashboardLayout(
  dashboardId = "operations-monitoring",
  userId = "default"
): Promise<DashboardLayoutResponse> {
  const params = new URLSearchParams({
    dashboardId,
    userId
  });
  return requestJson<DashboardLayoutResponse>(`/api/system/dashboard-layout?${params.toString()}`);
}

export async function saveDashboardLayout(
  layout: DashboardLayoutDocument,
  dashboardId = "operations-monitoring",
  userId = "default"
): Promise<void> {
  await requestJson("/api/system/dashboard-layout", {
    method: "PUT",
    body: JSON.stringify({
      dashboardId,
      userId,
      layout
    })
  });
}

export async function fetchApplications(): Promise<ApplicationListItem[]> {
  const response = await requestJson<{ applications: ApplicationListItem[] }>("/api/applications");
  const operationsByApplication = await Promise.all(
    response.applications.map(async (application) => ({
      applicationId: application.application_id,
      operations: await fetchOperationsForApplication(application.application_id, 8).catch(() => [])
    }))
  );

  const operationsMap = new Map(operationsByApplication.map((entry) => [entry.applicationId, entry.operations]));
  return response.applications.map((application) =>
    mapOperationsToApplicationSummary(application, operationsMap.get(application.application_id) ?? [])
  );
}

export async function fetchEvents(limit = 50): Promise<SystemEvent[]> {
  const response = await requestJson<{ events: SystemEvent[] }>(`/api/events?limit=${limit}`);
  return response.events;
}

export async function fetchJobs(limit = 80): Promise<ApplicationJob[]> {
  const applications = await fetchApplications();
  const operationsGroups = await Promise.all(
    applications.map(async (application) => ({
      application,
      operations: await fetchOperationsForApplication(application.application_id, Math.min(limit, 20)).catch(() => [])
    }))
  );

  return operationsGroups
    .flatMap(({ application, operations }) =>
      operations.map((operation) => ({
        ...mapOperationToJob(operation),
        application_name: application.name
      }))
    )
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}

export async function createApplication(payload: CreateApplicationPayload): Promise<CreateApplicationResponse> {
  const created = await requestJson<CreateApplicationResponse>("/api/applications", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const deployOperation = await createOperation(created.applicationId, {
    type: "deploy",
    parameters: {
      rebuild: true
    }
  });

  return {
    ...created,
    jobId: deployOperation.operationId
  };
}

export async function fetchApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const response = await requestJson<ApplicationDetail & { operations?: OperationDto[] }>(`/api/applications/${applicationId}`);
  const operations = response.operations ?? [];
  return {
    ...response,
    jobs: operations.map((operation) => mapOperationToJob(operation))
  };
}

export async function updateApplicationDeployment(applicationId: string, payload: UpdateDeploymentPayload): Promise<void> {
  await requestJson(`/api/applications/${applicationId}/deployment`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function inspectApplicationDeploymentCompose(
  applicationId: string,
  composePath: string
): Promise<ApplicationComposeInspection> {
  const params = new URLSearchParams({ composePath });
  return requestJson<ApplicationComposeInspection>(`/api/applications/${applicationId}/deployment/inspection?${params.toString()}`);
}

export async function resolveImportSource(sourceUrl: string): Promise<ImportResolveResponse> {
  const response = await requestJson<unknown>("/api/applications/import/resolve", {
    method: "POST",
    body: JSON.stringify({ sourceUrl })
  });
  return validateImportResolveResponse(response);
}

export async function inspectComposeFile(
  repositoryUrl: string,
  branch: string,
  composePath: string
): Promise<ImportComposeInspectResponse> {
  return requestJson<ImportComposeInspectResponse>("/api/applications/import/compose-inspect", {
    method: "POST",
    body: JSON.stringify({ repositoryUrl, branch, composePath })
  });
}

export async function restartApplication(applicationId: string): Promise<void> {
  await createOperation(applicationId, { type: "restart" });
}

export async function stopApplication(applicationId: string): Promise<void> {
  await createOperation(applicationId, { type: "stop" });
}

export async function resumeApplication(applicationId: string): Promise<void> {
  await createOperation(applicationId, { type: "resume" });
}

export async function rebuildApplication(applicationId: string, keepData: boolean): Promise<void> {
  await createOperation(applicationId, {
    type: "rebuild",
    parameters: { keepData }
  });
}

export async function checkUpdate(applicationId: string): Promise<void> {
  await createOperation(applicationId, { type: "update-check" });
}

export async function applyUpdate(applicationId: string): Promise<void> {
  const detail = await fetchApplicationDetail(applicationId);
  const targetRevision = detail.updateInfo?.latest_remote_commit;
  if (!targetRevision) {
    throw new Error("更新対象のリビジョンがまだ確認できていません。先に更新確認を実行してください。");
  }
  await createOperation(applicationId, {
    type: "update",
    parameters: { targetRevision }
  });
}

export async function rollbackApplication(applicationId: string): Promise<void> {
  const detail = await fetchApplicationDetail(applicationId);
  const targetRevision = detail.application.previous_commit;
  if (!targetRevision) {
    throw new Error("ロールバック対象の previous commit がありません。");
  }
  await createOperation(applicationId, {
    type: "rollback",
    parameters: { targetRevision }
  });
}

export async function syncInfrastructure(reason = "dashboard"): Promise<void> {
  await requestJson(`/api/infrastructure/sync?reason=${encodeURIComponent(reason)}`, {
    method: "POST"
  });
}

export async function deleteApplication(applicationId: string, mode: DeleteMode): Promise<void> {
  await createOperation(applicationId, {
    type: "delete",
    parameters: {
      mode: toDeleteOperationMode(mode)
    }
  });
}

export async function retryJob(jobId: string): Promise<void> {
  await requestJson(`/api/operations/${jobId}/retry`, {
    method: "POST"
  });
}

export async function cancelJob(jobId: string): Promise<void> {
  await requestJson(`/api/operations/${jobId}/cancel`, {
    method: "POST"
  });
}

export async function deleteJob(jobId: string): Promise<void> {
  throw new Error("完了済み Operation を削除する API は廃止されました。");
}

export async function fetchRegistrationFixtures(): Promise<RegistrationFixture[]> {
  const response = await requestJson<{ fixtures: RegistrationFixture[] }>("/api/testing/registration-fixtures");
  return response.fixtures;
}

export async function fetchApplicationLogServices(applicationId: string): Promise<string[]> {
  const response = await fetchApplicationLogs(applicationId);
  return response.services ?? [];
}

export async function fetchApplicationLogs(
  applicationId: string,
  options: { service?: string; tail?: number } = {}
): Promise<ApplicationLogsResponse> {
  const params = new URLSearchParams();
  if (options.service) {
    params.set("service", options.service);
  }
  if (options.tail) {
    params.set("tail", String(options.tail));
  }
  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";
  return requestJson<ApplicationLogsResponse>(`/api/applications/${applicationId}/runtime-logs${suffix}`);
}

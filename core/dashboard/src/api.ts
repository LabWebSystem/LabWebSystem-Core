import type {
  ApplicationComposeInspection,
  ApplicationDetail,
  ApplicationJob,
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
      typeof errorBody === "object" && errorBody && "message" in errorBody
        ? String(errorBody.message)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return requestJson<SystemStatus>("/api/system/status");
}

export async function fetchApplications(): Promise<ApplicationListItem[]> {
  const response = await requestJson<{ applications: ApplicationListItem[] }>("/api/applications");
  return response.applications;
}

export async function fetchEvents(limit = 50): Promise<SystemEvent[]> {
  const response = await requestJson<{ events: SystemEvent[] }>(`/api/events?limit=${limit}`);
  return response.events;
}

export async function fetchJobs(limit = 80): Promise<ApplicationJob[]> {
  const response = await requestJson<{ jobs: ApplicationJob[] }>(`/api/jobs?limit=${limit}`);
  return response.jobs;
}

export async function createApplication(payload: CreateApplicationPayload): Promise<CreateApplicationResponse> {
  return requestJson<CreateApplicationResponse>("/api/applications", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  return requestJson<ApplicationDetail>(`/api/applications/${applicationId}`);
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
  return requestJson<ApplicationComposeInspection>(`/api/applications/${applicationId}/deployment/inspect`, {
    method: "POST",
    body: JSON.stringify({ composePath })
  });
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
  await requestJson(`/api/applications/${applicationId}/restart`, {
    method: "POST"
  });
}

export async function stopApplication(applicationId: string): Promise<void> {
  await requestJson(`/api/applications/${applicationId}/stop`, {
    method: "POST"
  });
}

export async function resumeApplication(applicationId: string): Promise<void> {
  await requestJson(`/api/applications/${applicationId}/resume`, {
    method: "POST"
  });
}

export async function rebuildApplication(applicationId: string, keepData: boolean): Promise<void> {
  await requestJson(`/api/applications/${applicationId}/rebuild`, {
    method: "POST",
    body: JSON.stringify({ keepData })
  });
}

export async function checkUpdate(applicationId: string): Promise<void> {
  await requestJson(`/api/applications/${applicationId}/update-check`, {
    method: "POST"
  });
}

export async function applyUpdate(applicationId: string): Promise<void> {
  await requestJson(`/api/applications/${applicationId}/update`, {
    method: "POST"
  });
}

export async function rollbackApplication(applicationId: string): Promise<void> {
  await requestJson(`/api/applications/${applicationId}/rollback`, {
    method: "POST"
  });
}

export async function syncInfrastructure(reason = "dashboard"): Promise<void> {
  await requestJson(`/api/infrastructure/sync?reason=${encodeURIComponent(reason)}`, {
    method: "POST"
  });
}

export async function deleteApplication(applicationId: string, mode: DeleteMode): Promise<void> {
  await requestJson(`/api/applications/${applicationId}`, {
    method: "DELETE",
    body: JSON.stringify({ mode })
  });
}

export async function retryJob(jobId: string): Promise<void> {
  await requestJson(`/api/jobs/${jobId}/retry`, {
    method: "POST"
  });
}

export async function cancelJob(jobId: string): Promise<void> {
  await requestJson(`/api/jobs/${jobId}/cancel`, {
    method: "POST"
  });
}

export async function fetchRegistrationFixtures(): Promise<RegistrationFixture[]> {
  const response = await requestJson<{ fixtures: RegistrationFixture[] }>("/api/testing/registration-fixtures");
  return response.fixtures;
}

export async function fetchApplicationLogServices(applicationId: string): Promise<string[]> {
  const response = await requestJson<{ services: string[] }>(`/api/logs/${applicationId}/services`);
  return response.services;
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
  return requestJson<ApplicationLogsResponse>(`/api/logs/${applicationId}${suffix}`);
}

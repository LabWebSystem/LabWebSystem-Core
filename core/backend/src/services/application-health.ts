import { nowIso } from "../lib/db.js";

const HEALTH_TIMEOUT_MS = 2000;
const SLOW_RESPONSE_THRESHOLD_MS = 1500;

type ContainerSnapshotInput = {
  health_state?: string | null;
};

export type ApplicationHealthCheck = {
  state: "healthy" | "slow" | "page_error" | "runtime_error" | "unreachable" | "pending" | "stopped" | "unknown";
  severity: "ok" | "warning" | "critical" | "inactive" | "unknown";
  summary: string;
  checked_at: string;
  url: string | null;
  http_status: number | null;
  response_time_ms: number | null;
  reachable: boolean | null;
  container_summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  detail: string | null;
};

type ProbeResult = {
  reachable: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  error: string | null;
};

type AssessApplicationHealthInput = {
  status: string;
  hostname: string | null | undefined;
  enabled: boolean;
  containers: ContainerSnapshotInput[];
};

function summarizeContainers(containers: ContainerSnapshotInput[]) {
  const summary = {
    total: containers.length,
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0
  };

  for (const container of containers) {
    const state = String(container.health_state ?? "unknown").toLowerCase();
    if (state === "healthy" || state === "running") {
      summary.healthy += 1;
      continue;
    }
    if (state === "starting" || state === "restarting" || state === "created" || state === "paused") {
      summary.warning += 1;
      continue;
    }
    if (state === "unhealthy" || state === "dead" || state === "exited") {
      summary.critical += 1;
      continue;
    }
    summary.unknown += 1;
  }

  return summary;
}

async function probeUrl(url: string): Promise<ProbeResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "user-agent": "lab-core-health-check"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS)
    });

    return {
      reachable: true,
      httpStatus: response.status,
      responseTimeMs: Date.now() - startedAt,
      error: null
    };
  } catch (error) {
    return {
      reachable: false,
      httpStatus: null,
      responseTimeMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown_error"
    };
  }
}

function buildHealthResponse(
  base: Omit<ApplicationHealthCheck, "checked_at" | "container_summary">,
  containerSummary: ApplicationHealthCheck["container_summary"]
): ApplicationHealthCheck {
  return {
    ...base,
    checked_at: nowIso(),
    container_summary: containerSummary
  };
}

export async function assessApplicationHealth(input: AssessApplicationHealthInput): Promise<ApplicationHealthCheck> {
  const containerSummary = summarizeContainers(input.containers);
  const normalizedStatus = input.status.trim();
  const url = input.hostname ? `http://${input.hostname}` : null;

  if (!input.enabled || normalizedStatus === "Stopped") {
    return buildHealthResponse(
      {
        state: "stopped",
        severity: "inactive",
        summary: "停止中です",
        url,
        http_status: null,
        response_time_ms: null,
        reachable: null,
        detail: "このアプリは現在公開を停止しています。"
      },
      containerSummary
    );
  }

  if (["Build Pending", "Cloning", "Deploying", "Rebuilding", "Deleting"].includes(normalizedStatus)) {
    return buildHealthResponse(
      {
        state: "pending",
        severity: "warning",
        summary: "処理中です",
        url,
        http_status: null,
        response_time_ms: null,
        reachable: null,
        detail: "ジョブの進行中はヘルス結果が安定しないため、処理状況を優先表示しています。"
      },
      containerSummary
    );
  }

  if (!url) {
    return buildHealthResponse(
      {
        state: "unknown",
        severity: "unknown",
        summary: "URL 未設定です",
        url: null,
        http_status: null,
        response_time_ms: null,
        reachable: null,
        detail: "公開 URL を解決できないため、URL 監視を実行できませんでした。"
      },
      containerSummary
    );
  }

  const probe = await probeUrl(url);
  if (!probe.reachable) {
    return buildHealthResponse(
      {
        state: "unreachable",
        severity: "critical",
        summary: "URL に到達できません",
        url,
        http_status: null,
        response_time_ms: probe.responseTimeMs,
        reachable: false,
        detail: probe.error ?? "URL へ接続できませんでした。"
      },
      containerSummary
    );
  }

  if ((probe.httpStatus ?? 0) >= 500 || containerSummary.critical > 0) {
    return buildHealthResponse(
      {
        state: "runtime_error",
        severity: "critical",
        summary: "アプリでエラーが発生しています",
        url,
        http_status: probe.httpStatus,
        response_time_ms: probe.responseTimeMs,
        reachable: true,
        detail:
          (probe.httpStatus ?? 0) >= 500
            ? `HTTP ${probe.httpStatus} を返しました。`
            : "コンテナに異常状態が含まれています。"
      },
      containerSummary
    );
  }

  if ((probe.httpStatus ?? 0) >= 400) {
    return buildHealthResponse(
      {
        state: "page_error",
        severity: "warning",
        summary: "ページ応答を確認してください",
        url,
        http_status: probe.httpStatus,
        response_time_ms: probe.responseTimeMs,
        reachable: true,
        detail: `URL には到達しましたが、HTTP ${probe.httpStatus} が返りました。`
      },
      containerSummary
    );
  }

  if ((probe.responseTimeMs ?? 0) >= SLOW_RESPONSE_THRESHOLD_MS || containerSummary.warning > 0 || containerSummary.unknown > 0) {
    return buildHealthResponse(
      {
        state: "slow",
        severity: "warning",
        summary: (probe.responseTimeMs ?? 0) >= SLOW_RESPONSE_THRESHOLD_MS ? "応答が遅めです" : "一部状態を確認中です",
        url,
        http_status: probe.httpStatus,
        response_time_ms: probe.responseTimeMs,
        reachable: true,
        detail:
          (probe.responseTimeMs ?? 0) >= SLOW_RESPONSE_THRESHOLD_MS
            ? `${probe.responseTimeMs}ms で応答しました。`
            : "コンテナのヘルスが安定するまで監視を継続してください。"
      },
      containerSummary
    );
  }

  return buildHealthResponse(
    {
      state: "healthy",
      severity: "ok",
      summary: "正常に応答しています",
      url,
      http_status: probe.httpStatus,
      response_time_ms: probe.responseTimeMs,
      reachable: true,
      detail: probe.responseTimeMs ? `${probe.responseTimeMs}ms で応答しました。` : null
    },
    containerSummary
  );
}

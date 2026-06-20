import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaArrowUpFromBracket,
  FaArrowsUpToLine,
  FaClockRotateLeft,
  FaFloppyDisk,
  FaHammer,
  FaPlay,
  FaRotateLeft,
  FaStop,
  FaTrash
} from "react-icons/fa6";

import { ComposeInspectDialog } from "../components/ComposeInspectDialog";
import type {
  ApplicationDetail,
  ApplicationJob,
  ApplicationListItem,
  ComposeServiceCandidate,
  DeleteMode
} from "../types";
import {
  buildOperationLockReason,
  canCancelJob,
  canDeleteJob,
  canRetryJob,
  healthMeta,
  jobStatusLabel,
  jobTypeLabel,
  logLineClass,
  statusBadgeClass,
  toLocale
} from "../ui";

export type DetailLogState = {
  opened: boolean;
  services: string[];
  selectedService: string;
  tail: number;
  lines: string[];
  lastFetchedAt: string;
  loading: boolean;
  autoScroll: boolean;
};

type DeploymentFormState = {
  composePath: string;
  publicServiceName: string;
  publicPort: string;
  hostname: string;
  keepVolumesOnRebuild: boolean;
  envOverrides: Record<string, string>;
};

type DeploymentComposeState = {
  status: "idle" | "loading" | "ready" | "error";
  composeCandidates: string[];
  yamlFiles: string[];
  services: ComposeServiceCandidate[];
  selectedComposePath: string;
  inspection: ApplicationDetail["composeInspection"];
  warning: string;
};

type OperationLogItem = {
  operationId: string;
  sequence: number;
  stepId: string | null;
  stream: "stdout" | "stderr" | "system";
  line: string;
  createdAt: string;
};

type OperationDto = {
  operationId: string;
  applicationId: string;
  type: string;
  status: ApplicationJob["status"];
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepOrder: number | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type OperationLogsResponse = {
  operationId: string;
  logsAvailable: boolean;
  items: OperationLogItem[];
  nextAfter: number | null;
  hasMore: boolean;
};

type OperationSnapshotEvent = {
  operation: OperationDto;
  logs: OperationLogItem[];
  nextAfter: number | null;
  logsAvailable: boolean;
  timestamp: string;
};

type OperationStepEvent = {
  stepId: string;
  operationId: string;
  stepOrder: number;
  name: string;
  status: string;
  startedAt: string | null;
  updatedAt: string;
  finishedAt: string | null;
  message: string | null;
};

type ApplicationDetailViewProps = {
  application: ApplicationListItem | null;
  detail: ApplicationDetail | null;
  jobs: ApplicationJob[];
  detailLoading: boolean;
  loading: boolean;
  logs: DetailLogState;
  deploymentForm: DeploymentFormState;
  deploymentComposeState: DeploymentComposeState;
  deploymentDirty: boolean;
  deleteMode: DeleteMode;
  deleteConfirmText: string;
  onBackToApplications: () => void;
  onDeploymentFieldChange: <K extends keyof DeploymentFormState>(key: K, value: DeploymentFormState[K]) => void;
  onDeploymentEnvironmentOverrideChange: (name: string, value: string) => void;
  onSelectDeploymentCompose: (composePath: string) => void;
  onSelectDeploymentService: (service: ComposeServiceCandidate) => void;
  onResetDeployment: () => void;
  onSaveDeployment: () => void;
  onStop: (applicationId: string, applicationName: string) => void;
  onResume: (applicationId: string, applicationName: string) => void;
  onRestart: (applicationId: string, applicationName: string) => void;
  onRebuild: (applicationId: string, applicationName: string) => void;
  onCheckUpdate: (applicationId: string, applicationName: string) => void;
  onApplyUpdate: (applicationId: string, applicationName: string) => void;
  onRollback: (applicationId: string, applicationName: string) => void;
  onRetryJob: (jobId: string, typeLabel: string) => void;
  onCancelJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onOpenLogs: (application: ApplicationListItem) => void;
  onRefreshLogs: (service?: string, tail?: number) => void;
  onSetSelectedLogService: (service: string) => void;
  onSetLogTail: (tail: number) => void;
  onSetAutoScroll: (enabled: boolean) => void;
  onDeleteModeChange: (mode: DeleteMode) => void;
  onDeleteConfirmChange: (value: string) => void;
  onDeleteSubmit: () => void;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const OPERATION_LOG_DEBUG_STORAGE_KEY = "lab-core:operation-log-debug";
const ACTIVE_JOB_STATUSES: ApplicationJob["status"][] = ["queued", "running"];
const OPERATION_LOG_TARGET_TYPES = new Set([
  "deploy",
  "restart",
  "stop",
  "resume",
  "rebuild",
  "update-check",
  "update",
  "rollback",
  "delete"
]);

function isOperationLogDebugEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  try {
    return window.localStorage.getItem(OPERATION_LOG_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function operationLogDebug(message: string, payload?: Record<string, unknown>) {
  if (!isOperationLogDebugEnabled()) {
    return;
  }

  if (payload) {
    console.log(`[operation-log] ${message}`, payload);
    return;
  }

  console.log(`[operation-log] ${message}`);
}

function operationLogCount(label: string) {
  if (!isOperationLogDebugEnabled()) {
    return;
  }

  console.count(`[operation-log] ${label}`);
}

function panelTitle(title: string) {
  return <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3>;
}

function actionButtonBase(tone: "default" | "danger" | "primary") {
  if (tone === "danger") {
    return "flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3.5 py-2 text-sm font-bold text-red-700 transition-all hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
  }

  if (tone === "primary") {
    return "flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white transition-all hover:bg-amber-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
  }

  return "flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
}

function isActiveJob(job: ApplicationJob): boolean {
  return ACTIVE_JOB_STATUSES.includes(job.status);
}

function sortJobsDesc(a: ApplicationJob, b: ApplicationJob): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function selectOperationLogTarget(jobs: ApplicationJob[]): ApplicationJob | null {
  const candidates = jobs
    .filter((job) => OPERATION_LOG_TARGET_TYPES.has(job.type))
    .slice()
    .sort(sortJobsDesc);

  return candidates.find((job) => isActiveJob(job)) ?? candidates[0] ?? null;
}

function parseSseJson<T>(event: MessageEvent<string>): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch (error) {
    operationLogDebug("parse-sse-json-failed", {
      data: event.data,
      error: error instanceof Error ? error.message : String(error)
    });

    return null;
  }
}

function operationLogKey(log: OperationLogItem): string {
  return `${log.operationId}:${log.sequence}:${log.stream}`;
}

function formatOperationLogLine(log: OperationLogItem): string {
  const timestamp = log.createdAt ? toLocale(log.createdAt) : "--:--:--";
  return `[${timestamp}] ${log.stream.toUpperCase()} ${log.line}`;
}

function formatOperationStatusLine(operation: OperationDto): string {
  const timestamp = operation.updatedAt ? toLocale(operation.updatedAt) : "--:--:--";
  return `[${timestamp}] SYSTEM operation ${operation.type} is ${operation.status}`;
}

function formatOperationStepLine(step: OperationStepEvent): string {
  const timestamp = step.updatedAt ? toLocale(step.updatedAt) : "--:--:--";
  const message = step.message ? ` - ${step.message}` : "";
  return `[${timestamp}] SYSTEM step ${step.name} is ${step.status}${message}`;
}

function isTerminalJobStatus(status: ApplicationJob["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "interrupted";
}

function shouldStreamJobLogs(job: ApplicationJob | null): boolean {
  if (!job) {
    return false;
  }

  return job.status === "queued" || job.status === "running";
}

export function ApplicationDetailView(props: ApplicationDetailViewProps) {
  const {
    application,
    detail,
    jobs,
    detailLoading,
    loading,
    logs,
    deploymentForm,
    deploymentComposeState,
    deploymentDirty,
    deleteMode,
    deleteConfirmText,
    onBackToApplications,
    onDeploymentFieldChange,
    onDeploymentEnvironmentOverrideChange,
    onSelectDeploymentCompose,
    onSelectDeploymentService,
    onResetDeployment,
    onSaveDeployment,
    onStop,
    onResume,
    onRestart,
    onRebuild,
    onCheckUpdate,
    onApplyUpdate,
    onRollback,
    onRetryJob,
    onCancelJob,
    onDeleteJob,
    onOpenLogs,
    onRefreshLogs,
    onSetSelectedLogService,
    onSetLogTail,
    onSetAutoScroll,
    onDeleteModeChange,
    onDeleteConfirmChange,
    onDeleteSubmit
  } = props;

  const [inspectDialogOpen, setInspectDialogOpen] = useState(false);
  const [operationLogLines, setOperationLogLines] = useState<string[]>([]);
  const [operationLogState, setOperationLogState] = useState<"idle" | "connecting" | "open" | "closed" | "error">(
    "idle"
  );
  const [operationLogLastFetchedAt, setOperationLogLastFetchedAt] = useState("");
  const seenOperationLogsRef = useRef(new Set<string>());
  const logViewerRef = useRef<HTMLDivElement | null>(null);
  const renderCountRef = useRef(0);
  const eventSourceConnectionSeqRef = useRef(0);

  renderCountRef.current += 1;

  const relatedJobs = useMemo(() => {
    const source = jobs.length > 0 ? jobs : detail?.jobs ?? [];
    return source.slice().sort(sortJobsDesc);
  }, [detail?.jobs, jobs]);

  const operationLogTarget = useMemo(() => selectOperationLogTarget(relatedJobs), [relatedJobs]);
  const operationLogTargetId = operationLogTarget?.job_id ?? null;
  const operationLogTargetStatus = operationLogTarget?.status ?? null;
  const shouldStreamOperationLogs = shouldStreamJobLogs(operationLogTarget);
  const operationLogEnabled = Boolean(operationLogTargetId);

  const liveLogLines = operationLogEnabled ? operationLogLines : logs.lines;
  const liveLogLoading = operationLogEnabled ? operationLogState === "connecting" : logs.loading;
  const liveLogLastFetchedAt = operationLogEnabled ? operationLogLastFetchedAt : logs.lastFetchedAt;

  useEffect(() => {
    operationLogDebug("render", {
      renderCount: renderCountRef.current,
      applicationId: application?.application_id ?? null,
      operationLogTargetId,
      operationLogTargetStatus,
      shouldStreamOperationLogs,
      operationLogState,
      operationLogLines: operationLogLines.length,
      runtimeLogLines: logs.lines.length,
      tail: logs.tail
    });
  });

  useEffect(() => {
    if (!logs.autoScroll || !logViewerRef.current) {
      return;
    }

    logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;

    operationLogDebug("auto-scroll", {
      lineCount: liveLogLines.length,
      usingOperationLogs: operationLogEnabled
    });
  }, [liveLogLines, logs.autoScroll, operationLogEnabled]);

  useEffect(() => {
    setInspectDialogOpen(false);
  }, [application?.application_id]);

  useEffect(() => {
    operationLogDebug("stream-decision", {
      operationId: operationLogTargetId,
      status: operationLogTargetStatus,
      shouldStream: shouldStreamOperationLogs,
      tail: logs.tail,
      applicationId: application?.application_id ?? null
    });

    if (!operationLogTargetId) {
      seenOperationLogsRef.current.clear();
      setOperationLogLines([]);
      setOperationLogState("idle");
      setOperationLogLastFetchedAt("");

      operationLogDebug("no-operation-target", {
        applicationId: application?.application_id ?? null
      });

      return;
    }

    let disposed = false;
    const seen = new Set<string>();
    seenOperationLogsRef.current = seen;

    const connectionSeq = eventSourceConnectionSeqRef.current + 1;
    eventSourceConnectionSeqRef.current = connectionSeq;

    const updateOperationLogState = (nextState: "idle" | "connecting" | "open" | "closed" | "error") => {
      operationLogDebug("state-change", {
        connectionSeq,
        operationId: operationLogTargetId,
        from: operationLogState,
        to: nextState,
        disposed
      });

      setOperationLogState(nextState);
    };

    const appendLines = (nextLines: string[], reason: string) => {
      if (nextLines.length === 0) {
        operationLogDebug("append-lines-skipped-empty", {
          connectionSeq,
          operationId: operationLogTargetId,
          reason
        });

        return;
      }

      setOperationLogLines((prev) => {
        const merged = [...prev, ...nextLines].slice(-logs.tail);

        operationLogDebug("append-lines", {
          connectionSeq,
          operationId: operationLogTargetId,
          reason,
          previous: prev.length,
          received: nextLines.length,
          next: merged.length,
          tail: logs.tail
        });

        return merged;
      });

      setOperationLogLastFetchedAt(new Date().toISOString());
    };

    const appendLogs = (items: OperationLogItem[], reason: string) => {
      let duplicated = 0;
      let appended = 0;
      const nextLines: string[] = [];

      for (const item of items) {
        const key = operationLogKey(item);

        if (seen.has(key)) {
          duplicated += 1;
          continue;
        }

        seen.add(key);
        appended += 1;
        nextLines.push(formatOperationLogLine(item));
      }

      operationLogDebug("append-logs", {
        connectionSeq,
        operationId: operationLogTargetId,
        reason,
        received: items.length,
        appended,
        duplicated,
        seen: seen.size
      });

      appendLines(nextLines, reason);
    };

    setOperationLogLines([]);
    setOperationLogLastFetchedAt("");
    updateOperationLogState("connecting");

    const logsUrl = `${API_BASE_URL}/api/operations/${operationLogTargetId}/logs?tail=${logs.tail}`;

    operationLogDebug("fetch-snapshot-start", {
      connectionSeq,
      operationId: operationLogTargetId,
      logsUrl
    });

    fetch(logsUrl)
      .then(async (response) => {
        operationLogDebug("fetch-snapshot-response", {
          connectionSeq,
          operationId: operationLogTargetId,
          ok: response.ok,
          status: response.status
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as OperationLogsResponse;
      })
      .then((snapshot) => {
        if (disposed) {
          operationLogDebug("fetch-snapshot-disposed", {
            connectionSeq,
            operationId: operationLogTargetId
          });

          return;
        }

        appendLogs(snapshot.items, "http-snapshot");

        if (!shouldStreamOperationLogs) {
          updateOperationLogState("closed");
        }
      })
      .catch((error) => {
        if (!disposed) {
          updateOperationLogState("error");
        }

        operationLogDebug("fetch-snapshot-error", {
          connectionSeq,
          operationId: operationLogTargetId,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    if (!shouldStreamOperationLogs) {
      operationLogDebug("skip-event-source-for-terminal-operation", {
        connectionSeq,
        operationId: operationLogTargetId,
        status: operationLogTargetStatus
      });

      return () => {
        disposed = true;

        operationLogDebug("cleanup-snapshot-only", {
          connectionSeq,
          operationId: operationLogTargetId,
          status: operationLogTargetStatus
        });
      };
    }

    const debugQuery = isOperationLogDebugEnabled() ? "&debug=1" : "";
    const streamUrl = `${API_BASE_URL}/api/operations/${operationLogTargetId}/logs/stream?tail=${logs.tail}${debugQuery}`;

    operationLogCount("create EventSource");
    operationLogDebug("create-event-source", {
      connectionSeq,
      operationId: operationLogTargetId,
      status: operationLogTargetStatus,
      streamUrl
    });

    const source = new EventSource(streamUrl);

    source.onopen = () => {
      operationLogCount("EventSource open");

      operationLogDebug("event-source-open", {
        connectionSeq,
        operationId: operationLogTargetId,
        readyState: source.readyState,
        disposed
      });

      if (!disposed) {
        updateOperationLogState("open");
      }
    };

    source.addEventListener("snapshot", (event) => {
      operationLogCount("SSE snapshot");

      if (disposed) {
        operationLogDebug("snapshot-after-dispose", {
          connectionSeq,
          operationId: operationLogTargetId
        });

        return;
      }

      const payload = parseSseJson<OperationSnapshotEvent>(event as MessageEvent<string>);
      if (!payload) {
        return;
      }

      operationLogDebug("sse-snapshot", {
        connectionSeq,
        operationId: operationLogTargetId,
        status: payload.operation.status,
        receivedLogs: payload.logs.length,
        nextAfter: payload.nextAfter,
        logsAvailable: payload.logsAvailable,
        timestamp: payload.timestamp
      });

      appendLogs(payload.logs, "sse-snapshot");
      appendLines([formatOperationStatusLine(payload.operation)], "sse-snapshot-operation-status");

      if (isTerminalJobStatus(payload.operation.status)) {
        updateOperationLogState("closed");

        operationLogDebug("close-event-source-after-terminal-snapshot", {
          connectionSeq,
          operationId: operationLogTargetId,
          status: payload.operation.status,
          readyState: source.readyState
        });

        source.close();
      }
    });

    source.addEventListener("log", (event) => {
      operationLogCount("SSE log");

      if (disposed) {
        operationLogDebug("log-after-dispose", {
          connectionSeq,
          operationId: operationLogTargetId
        });

        return;
      }

      const payload = parseSseJson<OperationLogItem>(event as MessageEvent<string>);
      if (!payload) {
        return;
      }

      operationLogDebug("sse-log", {
        connectionSeq,
        operationId: operationLogTargetId,
        sequence: payload.sequence,
        stream: payload.stream,
        createdAt: payload.createdAt
      });

      appendLogs([payload], "sse-log");
    });

    source.addEventListener("step", (event) => {
      operationLogCount("SSE step");

      if (disposed) {
        operationLogDebug("step-after-dispose", {
          connectionSeq,
          operationId: operationLogTargetId
        });

        return;
      }

      const payload = parseSseJson<OperationStepEvent>(event as MessageEvent<string>);
      if (!payload) {
        return;
      }

      operationLogDebug("sse-step", {
        connectionSeq,
        operationId: operationLogTargetId,
        stepId: payload.stepId,
        name: payload.name,
        status: payload.status
      });

      appendLines([formatOperationStepLine(payload)], "sse-step");
    });

    source.addEventListener("operation", (event) => {
      operationLogCount("SSE operation");

      if (disposed) {
        operationLogDebug("operation-after-dispose", {
          connectionSeq,
          operationId: operationLogTargetId
        });

        return;
      }

      const payload = parseSseJson<OperationDto>(event as MessageEvent<string>);
      if (!payload) {
        return;
      }

      operationLogDebug("sse-operation", {
        connectionSeq,
        operationId: operationLogTargetId,
        status: payload.status,
        updatedAt: payload.updatedAt
      });

      appendLines([formatOperationStatusLine(payload)], "sse-operation");

      if (isTerminalJobStatus(payload.status)) {
        updateOperationLogState("closed");

        operationLogDebug("close-event-source-after-terminal-operation", {
          connectionSeq,
          operationId: operationLogTargetId,
          status: payload.status,
          readyState: source.readyState
        });

        source.close();
      }
    });

    source.addEventListener("heartbeat", (event) => {
      operationLogCount("SSE heartbeat");

      if (!disposed) {
        setOperationLogLastFetchedAt(new Date().toISOString());
      }

      operationLogDebug("sse-heartbeat", {
        connectionSeq,
        operationId: operationLogTargetId,
        data: (event as MessageEvent<string>).data,
        readyState: source.readyState,
        disposed
      });
    });

    source.onerror = () => {
      operationLogCount("EventSource error");

      operationLogDebug("event-source-error", {
        connectionSeq,
        operationId: operationLogTargetId,
        readyState: source.readyState,
        disposed
      });

      if (!disposed) {
        updateOperationLogState("error");
      }
    };

    return () => {
      disposed = true;

      operationLogCount("close EventSource");
      operationLogDebug("cleanup-event-source", {
        connectionSeq,
        operationId: operationLogTargetId,
        status: operationLogTargetStatus,
        readyStateBeforeClose: source.readyState
      });

      source.close();
    };
  }, [
    application?.application_id,
    logs.tail,
    operationLogTargetId,
    operationLogTargetStatus,
    shouldStreamOperationLogs
  ]);

  if (!application) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">アプリを選択すると詳細を表示します。</div>;
  }

  const currentApplication = application;
  const recentEvents = detail?.events ?? [];
  const currentHealth = healthMeta(detail?.health ?? currentApplication.health);
  const operationLockReason = buildOperationLockReason(currentApplication);
  const envKeys = [...new Set(Object.keys(deploymentForm.envOverrides))].sort((a, b) => a.localeCompare(b));
  const controlsDisabled = loading || Boolean(operationLockReason);

  function ensureRuntimeLogsOpened() {
    if (!logs.opened && !logs.loading) {
      onOpenLogs(currentApplication);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBackToApplications}
            className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-800"
          >
            <FaArrowLeft />
            アプリ一覧へ戻る
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <h2 className="truncate text-2xl font-black text-slate-900">{currentApplication.name}</h2>
            <span className={statusBadgeClass(currentApplication.status)}>{currentApplication.status}</span>
          </div>

          <p className="mt-1 break-all text-sm text-slate-500">{currentApplication.repository_url}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <div className="font-bold text-slate-900">{currentApplication.hostname}</div>
          <div className="mt-1 text-xs text-slate-500">
            {currentApplication.public_service_name}:{currentApplication.public_port}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {panelTitle("コントロールパネル")}
          {currentApplication.has_update ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">更新あり</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onResume(currentApplication.application_id, currentApplication.name)}
            disabled={controlsDisabled}
            className={actionButtonBase("default")}
          >
            <FaPlay />
            起動
          </button>

          <button
            type="button"
            onClick={() => onStop(currentApplication.application_id, currentApplication.name)}
            disabled={controlsDisabled}
            className={actionButtonBase("default")}
          >
            <FaStop />
            停止
          </button>

          <button
            type="button"
            onClick={() => onRestart(currentApplication.application_id, currentApplication.name)}
            disabled={controlsDisabled}
            className={actionButtonBase("default")}
          >
            <FaRotateLeft />
            再起動
          </button>

          <button
            type="button"
            onClick={() => onRebuild(currentApplication.application_id, currentApplication.name)}
            disabled={controlsDisabled}
            className={actionButtonBase("default")}
          >
            <FaHammer />
            再構築
          </button>

          <button
            type="button"
            onClick={() => onCheckUpdate(currentApplication.application_id, currentApplication.name)}
            disabled={controlsDisabled}
            className={actionButtonBase("default")}
          >
            <FaClockRotateLeft />
            更新確認
          </button>

          <button
            type="button"
            onClick={() => onApplyUpdate(currentApplication.application_id, currentApplication.name)}
            disabled={controlsDisabled}
            className={actionButtonBase("primary")}
          >
            <FaArrowUpFromBracket />
            更新適用
          </button>

          <button
            type="button"
            onClick={() => onRollback(currentApplication.application_id, currentApplication.name)}
            disabled={controlsDisabled}
            className={actionButtonBase("default")}
          >
            <FaArrowsUpToLine />
            ロールバック
          </button>
        </div>

        {operationLockReason ? <p className="mt-3 text-sm font-semibold text-amber-700">{operationLockReason}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {panelTitle("ライブログ")}
            {operationLogTarget ? (
              <p className="mt-1 text-xs text-slate-500">
                Operation: {jobTypeLabel(operationLogTarget.type)} / {jobStatusLabel(operationLogTarget.status)} / {operationLogTarget.job_id}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">実行中Operationがない場合はコンテナ実行ログを表示します。</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {operationLogEnabled ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                {shouldStreamOperationLogs ? `SSE: ${operationLogState}` : "SSE: snapshot only"}
              </span>
            ) : (
              <>
                <select
                  value={logs.selectedService}
                  onChange={(event) => {
                    const service = event.target.value;
                    onSetSelectedLogService(service);
                    onRefreshLogs(service);
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 focus:outline-none"
                >
                  <option value="">全サービス</option>
                  {logs.services.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </>
            )}

            <select
              value={logs.tail}
              onChange={(event) => {
                const tail = Number(event.target.value);
                onSetLogTail(tail);

                if (!operationLogEnabled) {
                  onRefreshLogs(undefined, tail);
                }
              }}
              className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 focus:outline-none"
            >
              <option value={50}>50行</option>
              <option value={100}>100行</option>
              <option value={200}>200行</option>
              <option value={500}>500行</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <input
                type="checkbox"
                checked={logs.autoScroll}
                onChange={(event) => onSetAutoScroll(event.target.checked)}
                className="rounded border-slate-300"
              />
              自動スクロール
            </label>

            {!operationLogEnabled ? (
              <button
                type="button"
                onClick={() => {
                  ensureRuntimeLogsOpened();
                  onRefreshLogs();
                }}
                className="font-semibold text-violet-600 hover:text-violet-700"
              >
                {logs.loading ? "取得中..." : "更新"}
              </button>
            ) : null}

            <span className="text-xs text-slate-400">
              {liveLogLastFetchedAt ? `${toLocale(liveLogLastFetchedAt)} 取得` : "--:--:-- 取得"}
            </span>
          </div>
        </div>

        <div
          ref={logViewerRef}
          className="h-80 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100"
        >
          {liveLogLines.length === 0 ? (
            <p className="text-slate-400">{liveLogLoading ? "ログを取得しています..." : "ログはまだありません。"}</p>
          ) : (
            <ul className="space-y-0.5">
              {liveLogLines.map((line, index) => (
                <li key={`${index}-${line}`} className={logLineClass(line)}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {panelTitle("デプロイ設定")}

          <div className="flex flex-wrap gap-2">
            {deploymentComposeState.inspection ? (
              <button
                type="button"
                onClick={() => setInspectDialogOpen(true)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                解析結果
              </button>
            ) : null}

            <button
              type="button"
              onClick={onSaveDeployment}
              disabled={loading || !deploymentDirty}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FaFloppyDisk />
              設定保存
            </button>
          </div>
        </div>

        {deploymentComposeState.composeCandidates.length > 0 ? (
          <div className="mb-4">
            <div className="mb-2 text-xs font-bold text-slate-400">Compose候補</div>
            <div className="flex flex-wrap gap-2">
              {deploymentComposeState.composeCandidates.map((composePath) => (
                <button
                  key={composePath}
                  type="button"
                  onClick={() => onSelectDeploymentCompose(composePath)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${deploymentForm.composePath === composePath
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {composePath}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {deploymentComposeState.services.length > 0 ? (
          <div className="mb-4">
            <div className="mb-2 text-xs font-bold text-slate-400">公開対象サービス名</div>
            <div className="grid gap-2 md:grid-cols-2">
              {deploymentComposeState.services.map((service) => (
                <button
                  key={service.name}
                  type="button"
                  onClick={() => onSelectDeploymentService(service)}
                  className={`rounded-xl border p-3 text-left ${deploymentForm.publicServiceName === service.name
                      ? "border-violet-200 bg-violet-50 text-violet-800"
                      : "border-slate-200 bg-white text-slate-700"
                    }`}
                >
                  <div className="font-bold">{service.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {service.detectedPublicPort ? `推定ポート ${service.detectedPublicPort}` : "ポート未検出"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold text-slate-600">
            Composeファイルパス
            <input
              value={deploymentForm.composePath}
              onChange={(event) => onDeploymentFieldChange("composePath", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm font-bold text-slate-600">
            ホスト名
            <input
              value={deploymentForm.hostname}
              onChange={(event) => onDeploymentFieldChange("hostname", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm font-bold text-slate-600">
            公開対象サービス名
            <input
              value={deploymentForm.publicServiceName}
              onChange={(event) => onDeploymentFieldChange("publicServiceName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm font-bold text-slate-600">
            公開ポート番号
            <input
              value={deploymentForm.publicPort}
              onChange={(event) => onDeploymentFieldChange("publicPort", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={deploymentForm.keepVolumesOnRebuild}
            onChange={(event) => onDeploymentFieldChange("keepVolumesOnRebuild", event.target.checked)}
            className="rounded border-slate-300"
          />
          再構築時に永続ボリュームを保持する
        </label>

        <div className="mt-5">
          <div className="mb-2 text-sm font-bold text-slate-600">環境変数の設定</div>

          {envKeys.map((key) => (
            <label key={key} className="mb-3 block text-xs font-bold text-slate-500">
              {key}
              <input
                value={deploymentForm.envOverrides[key] ?? ""}
                onChange={(event) => onDeploymentEnvironmentOverrideChange(key, event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              />
            </label>
          ))}

          {envKeys.length === 0 ? <p className="text-sm text-slate-500">設定済みの環境変数はありません。</p> : null}
        </div>

        {deploymentComposeState.warning ? (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            {deploymentComposeState.warning}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onResetDeployment}
          disabled={!deploymentDirty}
          className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          編集を戻す
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          {panelTitle("関連ジョブ")}
          <span className="text-xs font-bold text-slate-400">{relatedJobs.length}件</span>
        </div>

        {relatedJobs.length === 0 ? <p className="text-sm text-slate-500">関連ジョブはまだありません。</p> : null}

        <div className="space-y-3">
          {relatedJobs.map((job) => (
            <div key={job.job_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-800">{jobTypeLabel(job.type)}</div>
                  <div className="mt-1 text-xs text-slate-400">{toLocale(job.created_at)}</div>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {jobStatusLabel(job.status)}
                </span>
              </div>

              {job.message ? <p className="mt-2 text-sm text-slate-600">{job.message}</p> : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {canCancelJob(job) ? (
                  <button
                    type="button"
                    onClick={() => onCancelJob(job.job_id)}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700"
                  >
                    取り消す
                  </button>
                ) : null}

                {canRetryJob(job) ? (
                  <button
                    type="button"
                    onClick={() => onRetryJob(job.job_id, jobTypeLabel(job.type))}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white"
                  >
                    再実行
                  </button>
                ) : null}

                {canDeleteJob(job) ? (
                  <button
                    type="button"
                    onClick={() => onDeleteJob(job.job_id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700"
                  >
                    削除
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {panelTitle("ヘルスチェック詳細")}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-lg">●</span>
            <div>
              <div className="font-bold text-slate-800">{currentHealth.description}</div>
              <div className="text-xs text-slate-400">{detail?.health?.checked_at ? toLocale(detail.health.checked_at) : "---"}</div>
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ヘルスチェック対象URL</dt>
              <dd className="break-all font-semibold text-slate-700">{detail?.health?.url ?? "---"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">HTTP ステータス</dt>
              <dd className="font-semibold text-slate-700">{detail?.health?.http_status ?? "---"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">レスポンス時間</dt>
              <dd className="font-semibold text-slate-700">
                {detail?.health?.response_time_ms ? `${detail.health.response_time_ms}ms` : "---"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {panelTitle("コンテナ一覧")}

          {(detail?.containers ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{detailLoading ? "読み込み中..." : "コンテナ情報はありません。"}</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {(detail?.containers ?? []).map((container) => (
              <div key={container.container_id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-slate-800">{container.service_name}</div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {container.health_state}
                  </span>
                </div>
                <div className="mt-1 break-all text-xs text-slate-500">{container.runtime_name}</div>
                <div className="mt-1 text-xs text-slate-400">
                  restart: {container.restart_count} / last seen: {toLocale(container.last_seen_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {panelTitle("最近のイベント")}

        {recentEvents.length === 0 ? <p className="mt-4 text-sm text-slate-500">イベントはまだありません。</p> : null}

        <div className="mt-4 space-y-3">
          {recentEvents.slice(0, 8).map((event) => (
            <div key={event.event_id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-800">{event.title}</div>
                <div className="text-xs text-slate-400">{toLocale(event.created_at)}</div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{event.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-red-100 bg-red-50/40 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FaTrash className="text-red-600" />
          {panelTitle("削除")}
        </div>

        <p className="text-sm text-red-700">破壊的操作です。削除範囲とアプリ名を確認して実行します。</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            value={deleteMode}
            onChange={(event) => onDeleteModeChange(event.target.value as DeleteMode)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none"
          >
            <option value="config_only">構成のみ削除</option>
            <option value="source_and_config">構成 + ソース削除</option>
            <option value="full">構成 + ソース + データ削除</option>
          </select>

          <input
            value={deleteConfirmText}
            onChange={(event) => onDeleteConfirmChange(event.target.value)}
            placeholder={currentApplication.name}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onDeleteSubmit}
          disabled={loading || deleteConfirmText.trim() !== currentApplication.name}
          className={`${actionButtonBase("danger")} mt-4`}
        >
          <FaTrash />
          削除ジョブを開始
        </button>
      </section>

      <ComposeInspectDialog
        open={inspectDialogOpen}
        title={`${currentApplication.name} / ${deploymentForm.composePath}`}
        inspection={deploymentComposeState.inspection}
        onClose={() => setInspectDialogOpen(false)}
      />
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
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
import type { ApplicationDetail, ApplicationJob, ApplicationListItem, ComposeServiceCandidate, DeleteMode } from "../types";
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

function panelTitle(title: string) {
  return <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3>;
}

function actionButtonBase(tone: "default" | "danger" | "primary") {
  if (tone === "danger") {
    return "flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3.5 py-2 text-sm font-bold text-red-700 transition-all hover:bg-red-50 active:scale-95";
  }
  if (tone === "primary") {
    return "flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-white transition-all hover:bg-amber-600 active:scale-95";
  }
  return "flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95";
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
  const logViewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logs.opened || !logs.autoScroll || !logViewerRef.current) {
      return;
    }
    logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
  }, [logs.autoScroll, logs.lines, logs.opened]);

  useEffect(() => {
    setInspectDialogOpen(false);
  }, [application?.application_id]);

  if (!application) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">アプリを選択すると詳細を表示します。</p>
        </div>
      </div>
    );
  }

  const currentApplication = application;
  const relatedJobs = jobs.length > 0 ? jobs : detail?.jobs ?? [];
  const recentEvents = detail?.events ?? [];
  const currentHealth = healthMeta(detail?.health ?? currentApplication.health);
  const operationLockReason = buildOperationLockReason(currentApplication);
  const envKeys = [...new Set(Object.keys(deploymentForm.envOverrides))].sort((a, b) => a.localeCompare(b));

  function ensureLogsOpened() {
    if (!logs.opened && !logs.loading) {
      onOpenLogs(currentApplication);
    }
  }

  return (
    <div className="min-h-0">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <button type="button" onClick={onBackToApplications} className="text-lg text-slate-400 transition-colors hover:text-slate-600">
          <FaArrowLeft />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">{currentApplication.name}</h2>
            <span className={statusBadgeClass(currentApplication.status)}>{currentApplication.status}</span>
          </div>
          <p className="text-xs text-slate-400">{currentApplication.repository_url}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              {panelTitle("コントロールパネル")}
              {currentApplication.has_update ? (
                <span className="animate-pulse rounded border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                  更新あり
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onResume(currentApplication.application_id, currentApplication.name)}
                disabled={Boolean(operationLockReason)}
                className={actionButtonBase("default")}
              >
                <FaPlay className="text-emerald-500" />
                起動
              </button>
              <button
                type="button"
                onClick={() => onStop(currentApplication.application_id, currentApplication.name)}
                disabled={Boolean(operationLockReason)}
                className={actionButtonBase("default")}
              >
                <FaStop className="text-rose-500" />
                停止
              </button>
              <button type="button" onClick={() => onRestart(currentApplication.application_id, currentApplication.name)} disabled={Boolean(operationLockReason)} className={actionButtonBase("default")}>
                <FaRotateLeft className="text-amber-500" />
                再起動
              </button>
              <button type="button" onClick={() => onRebuild(currentApplication.application_id, currentApplication.name)} disabled={Boolean(operationLockReason)} className={actionButtonBase("default")}>
                <FaHammer className="text-blue-500" />
                再構築
              </button>
              <button type="button" onClick={() => onCheckUpdate(currentApplication.application_id, currentApplication.name)} disabled={Boolean(operationLockReason)} className={actionButtonBase("default")}>
                <FaArrowsUpToLine />
                更新確認
              </button>
              <button type="button" onClick={() => onApplyUpdate(currentApplication.application_id, currentApplication.name)} disabled={Boolean(operationLockReason)} className={actionButtonBase("primary")}>
                <FaArrowUpFromBracket />
                更新適用
              </button>
              <button type="button" onClick={() => onRollback(currentApplication.application_id, currentApplication.name)} disabled={Boolean(operationLockReason)} className={actionButtonBase("default")}>
                <FaClockRotateLeft />
                ロールバック
              </button>
              <button type="button" className={`${actionButtonBase("danger")} ml-auto`} disabled>
                <FaTrash />
                削除
              </button>
            </div>

            {operationLockReason ? <p className="mt-3 text-sm text-amber-700">{operationLockReason}</p> : null}
          </div>

          <div className="flex h-[400px] flex-col rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                {panelTitle("ライブログ")}
                <select
                  value={logs.selectedService}
                  onFocus={ensureLogsOpened}
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
                <select
                  value={String(logs.tail)}
                  onFocus={ensureLogsOpened}
                  onChange={(event) => {
                    const tail = Number(event.target.value);
                    onSetLogTail(tail);
                    onRefreshLogs(undefined, tail);
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 focus:outline-none"
                >
                  <option value="50">50行</option>
                  <option value="100">100行</option>
                  <option value="200">200行</option>
                  <option value="500">500行</option>
                </select>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={logs.autoScroll} onChange={(event) => onSetAutoScroll(event.target.checked)} className="rounded border-slate-300" />
                  自動スクロール
                </label>
                <button type="button" onClick={() => { ensureLogsOpened(); onRefreshLogs(); }} className="font-semibold text-violet-600 hover:text-violet-700">
                  {logs.loading ? "取得中..." : "更新"}
                </button>
                <span>{logs.lastFetchedAt ? `${toLocale(logs.lastFetchedAt)}取得` : "--:--:--取得"}</span>
              </div>
            </div>
            <div ref={logViewerRef} className="flex-1 overflow-y-auto rounded-xl bg-slate-900 p-4 font-mono text-sm text-slate-200" onMouseEnter={ensureLogsOpened}>
              {logs.lines.length === 0 ? (
                <p className="text-slate-400">{logs.loading ? "ログを取得しています..." : "ログはまだありません。"}</p>
              ) : (
                <ul className="space-y-1">
                  {logs.lines.map((line, index) => (
                    <li key={`${index}-${line.slice(0, 20)}`} className={logLineClass(line)}>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              {panelTitle("デプロイ設定")}
              <div className="flex items-center gap-2">
                {deploymentComposeState.inspection ? (
                  <button type="button" onClick={() => setInspectDialogOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    解析結果
                  </button>
                ) : null}
                <button type="button" onClick={onSaveDeployment} disabled={loading || !deploymentDirty} className="flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-all shadow-sm hover:bg-violet-700 disabled:opacity-50">
                  <FaFloppyDisk className="text-xs" />
                  設定保存
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {deploymentComposeState.composeCandidates.length > 0 ? (
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">Compose候補</label>
                  <div className="flex flex-wrap gap-2">
                    {deploymentComposeState.composeCandidates.map((composePath) => (
                      <button
                        key={composePath}
                        type="button"
                        onClick={() => onSelectDeploymentCompose(composePath)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                          deploymentForm.composePath === composePath
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
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">公開対象サービス名</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {deploymentComposeState.services.map((service) => (
                      <button
                        key={service.name}
                        type="button"
                        onClick={() => onSelectDeploymentService(service)}
                        className={`rounded-xl border p-3 text-left ${
                          deploymentForm.publicServiceName === service.name
                            ? "border-violet-200 bg-violet-50 text-violet-800"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <div className="font-bold">{service.name}</div>
                        <div className="mt-1 text-xs">{service.detectedPublicPort ? `推定ポート ${service.detectedPublicPort}` : "ポート未検出"}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Composeファイルパス</label>
                  <input
                    type="text"
                    value={deploymentForm.composePath}
                    onChange={(event) => onDeploymentFieldChange("composePath", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">ホスト名</label>
                  <input
                    type="text"
                    value={deploymentForm.hostname}
                    onChange={(event) => onDeploymentFieldChange("hostname", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">公開対象サービス名</label>
                  <input
                    type="text"
                    value={deploymentForm.publicServiceName}
                    onChange={(event) => onDeploymentFieldChange("publicServiceName", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">公開ポート番号</label>
                  <input
                    type="number"
                    value={deploymentForm.publicPort}
                    onChange={(event) => onDeploymentFieldChange("publicPort", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={deploymentForm.keepVolumesOnRebuild}
                    onChange={(event) => onDeploymentFieldChange("keepVolumesOnRebuild", event.target.checked)}
                    className="rounded border-slate-300"
                  />
                  再構築時に永続ボリュームを保持する
                </label>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500">環境変数の設定</label>
                <div className="space-y-2">
                  {envKeys.map((key) => (
                    <div key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{key}</div>
                      <input
                        type="text"
                        value={deploymentForm.envOverrides[key] ?? ""}
                        onChange={(event) => onDeploymentEnvironmentOverrideChange(key, event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  ))}
                  {envKeys.length === 0 ? <p className="text-sm text-slate-400">設定済みの環境変数はありません。</p> : null}
                </div>
              </div>

              {deploymentComposeState.warning ? <p className="text-sm text-amber-700">{deploymentComposeState.warning}</p> : null}
              <div className="flex gap-2">
                <button type="button" onClick={onResetDeployment} disabled={loading || !deploymentDirty} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                  編集を戻す
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              {panelTitle("関連ジョブ")}
              <span className="text-xs font-semibold text-slate-400">{relatedJobs.length}件</span>
            </div>
            <div className="space-y-3">
              {relatedJobs.length === 0 ? <p className="text-sm text-slate-400">関連ジョブはまだありません。</p> : null}
              {relatedJobs.map((job) => (
                <div key={job.job_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{jobTypeLabel(job.type)}</p>
                      <p className="mt-1 text-xs text-slate-400">{jobStatusLabel(job.status)}</p>
                    </div>
                    <span className="text-xs text-slate-400">{toLocale(job.created_at)}</span>
                  </div>
                  {job.message ? <p className="mt-2 text-sm text-slate-600">{job.message}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canCancelJob(job) ? (
                      <button type="button" onClick={() => onCancelJob(job.job_id)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">
                        取り消す
                      </button>
                    ) : null}
                    {canRetryJob(job) ? (
                      <button type="button" onClick={() => onRetryJob(job.job_id, jobTypeLabel(job.type))} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white">
                        再実行
                      </button>
                    ) : null}
                    {canDeleteJob(job) ? (
                      <button type="button" onClick={() => onDeleteJob(job.job_id)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700">
                        削除
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            {panelTitle("ヘルスチェック詳細")}
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    currentHealth.tone === "ok"
                      ? "bg-emerald-500"
                      : currentHealth.tone === "warn"
                        ? "bg-amber-500"
                        : currentHealth.tone === "error"
                          ? "bg-rose-500"
                          : "bg-slate-400"
                  }`}
                >
                  ●
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-700">{currentHealth.description}</div>
                  <div className="text-xs text-slate-400">{detail?.health?.checked_at ? toLocale(detail.health.checked_at) : "---"}</div>
                </div>
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">ヘルスチェック対象URL</span>
                  <span className="font-mono font-semibold text-slate-700">{detail?.health?.url ?? "---"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">HTTP ステータス</span>
                  <span className="font-mono font-semibold text-slate-700">{detail?.health?.http_status ?? "---"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">レスポンス時間</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {detail?.health?.response_time_ms ? `${detail.health.response_time_ms}ms` : "---"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            {panelTitle("コンテナ一覧")}
            <div className="mt-4 space-y-3">
              {(detail?.containers ?? []).length === 0 ? <p className="text-sm text-slate-400">{detailLoading ? "読み込み中..." : "コンテナ情報はありません。"}</p> : null}
              {(detail?.containers ?? []).map((container) => (
                <div key={container.container_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800">{container.service_name}</span>
                    <span className="text-xs font-semibold text-slate-400">{container.health_state}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{container.runtime_name}</p>
                  <p className="mt-2 text-xs text-slate-500">restart: {container.restart_count} / last seen: {toLocale(container.last_seen_at)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            {panelTitle("最近のイベント")}
            <div className="mt-4 space-y-3">
              {recentEvents.length === 0 ? <p className="text-sm text-slate-400">イベントはまだありません。</p> : null}
              {recentEvents.slice(0, 8).map((event) => (
                <div key={event.event_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800">{event.title}</span>
                    <span className="text-xs text-slate-400">{toLocale(event.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{event.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            {panelTitle("削除")}
            <p className="mt-3 text-sm text-slate-500">破壊的操作です。削除範囲とアプリ名を確認して実行します。</p>
            <div className="mt-4 space-y-3">
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
                type="text"
                placeholder={currentApplication.name}
                value={deleteConfirmText}
                onChange={(event) => onDeleteConfirmChange(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-red-400"
              />
              <button
                type="button"
                onClick={onDeleteSubmit}
                disabled={loading || Boolean(operationLockReason)}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
              >
                削除ジョブを開始
              </button>
            </div>
          </div>
        </div>
      </div>

      <ComposeInspectDialog
        open={inspectDialogOpen}
        title="Compose Inspection"
        inspection={deploymentComposeState.inspection}
        onClose={() => setInspectDialogOpen(false)}
      />
    </div>
  );
}

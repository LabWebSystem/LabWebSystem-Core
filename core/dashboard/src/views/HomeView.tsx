import { FiActivity, FiAlertTriangle, FiArrowRight, FiCheckCircle, FiClock, FiExternalLink, FiXCircle } from "react-icons/fi";
import type { ApplicationJob, ApplicationListItem, SystemEvent, SystemStatus } from "../types";
import {
  buildAttentionSummary,
  formatRelative,
  healthMeta,
  jobTypeLabel,
  shortCommit,
  toLocale
} from "../ui";

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenDetail: (applicationId: string) => void;
};

function metricTone(kind: "ok" | "warn" | "error" | "neutral"): string {
  if (kind === "ok") {
    return "from-emerald-50 to-white text-emerald-900 ring-emerald-200";
  }
  if (kind === "warn") {
    return "from-amber-50 to-white text-amber-900 ring-amber-200";
  }
  if (kind === "error") {
    return "from-rose-50 to-white text-rose-900 ring-rose-200";
  }
  return "from-slate-50 to-white text-slate-900 ring-slate-200";
}

export function HomeView(props: HomeViewProps) {
  const { system, applications, jobs, events, onOpenApplications, onOpenDetail } = props;

  const healthyCount = applications.filter((application) => application.health?.severity === "ok").length;
  const warningCount = applications.filter((application) => application.health?.severity === "warning").length;
  const criticalCount = applications.filter((application) => application.health?.severity === "critical").length;
  const attentionApps = applications
    .filter((application) => {
      const severity = application.health?.severity;
      return severity === "critical" || severity === "warning" || application.status === "Failed";
    })
    .slice(0, 6);
  const failedJobs = jobs.filter((job) => job.status === "failed").slice(0, 5);
  const recentEvents = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 7);
  const recentApps = [...applications].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className={`rounded-3xl bg-gradient-to-br p-5 ring-1 ${metricTone("neutral")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">登録アプリ</span>
            <FiActivity className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight">{applications.length}</p>
          <p className="mt-2 text-sm text-slate-500">{system?.applicationSummary.running ?? 0} 件が稼働中</p>
        </article>

        <article className={`rounded-3xl bg-gradient-to-br p-5 ring-1 ${metricTone("ok")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-700">正常</span>
            <FiCheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight">{healthyCount}</p>
          <p className="mt-2 text-sm text-emerald-700/70">応答とコンテナが安定</p>
        </article>

        <article className={`rounded-3xl bg-gradient-to-br p-5 ring-1 ${metricTone("warn")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-700">要確認</span>
            <FiAlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight">{warningCount}</p>
          <p className="mt-2 text-sm text-amber-700/70">遅延・画面確認が必要</p>
        </article>

        <article className={`rounded-3xl bg-gradient-to-br p-5 ring-1 ${metricTone("error")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-rose-700">異常</span>
            <FiXCircle className="h-5 w-5 text-rose-500" />
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight">{criticalCount}</p>
          <p className="mt-2 text-sm text-rose-700/70">到達不可・実行エラー</p>
        </article>
      </section>

      <section className="grid min-h-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Attention</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">注意アプリ</h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={onOpenApplications}
            >
              一覧へ
              <FiArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {attentionApps.length === 0 ? <p className="text-sm text-slate-500">優先対応が必要なアプリはありません。</p> : null}
            {attentionApps.map((application) => {
              const health = healthMeta(application.health);
              return (
                <button
                  key={application.application_id}
                  type="button"
                  className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                  onClick={() => onOpenDetail(application.application_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold text-slate-950">{application.name}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {health.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{application.hostname}</p>
                    </div>
                    <FiExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-700" />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{buildAttentionSummary(application)}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{formatRelative(application.updated_at)}</span>
                    {application.health?.response_time_ms ? <span>{application.health.response_time_ms}ms</span> : null}
                    <span>{shortCommit(application.current_commit)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <div className="grid gap-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Failures</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">失敗ジョブ</h2>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">{failedJobs.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {failedJobs.length === 0 ? <p className="text-sm text-slate-500">失敗ジョブはありません。</p> : null}
              {failedJobs.map((job) => (
                <div key={job.job_id} className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{job.application_name ?? "システム"}</p>
                  <p className="mt-1 text-sm text-slate-600">{jobTypeLabel(job.type)}</p>
                  {job.message ? <p className="mt-2 line-clamp-2 text-sm text-rose-800">{job.message}</p> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">New</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">最近追加</h2>
              </div>
              <FiClock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 space-y-3">
              {recentApps.map((application) => (
                <button
                  key={application.application_id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => onOpenDetail(application.application_id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{application.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatRelative(application.created_at)}</p>
                  </div>
                  <FiArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Events</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">直近イベント</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{recentEvents.length}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentEvents.length === 0 ? <p className="text-sm text-slate-500">イベントはまだありません。</p> : null}
          {recentEvents.map((event) => (
            <article key={event.event_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{event.title}</p>
                  {event.application_name ? <p className="mt-1 text-xs text-slate-500">{event.application_name}</p> : null}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    event.level === "error"
                      ? "bg-rose-100 text-rose-700"
                      : event.level === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {event.level}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">{event.message}</p>
              <p className="mt-3 text-xs text-slate-500">{toLocale(event.created_at)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

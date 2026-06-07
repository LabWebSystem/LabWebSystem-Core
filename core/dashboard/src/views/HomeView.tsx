import { FiActivity, FiAlertTriangle, FiArrowRight, FiCheckCircle, FiClock, FiExternalLink, FiXCircle } from "react-icons/fi";
import type { ApplicationJob, ApplicationListItem, SystemEvent, SystemStatus } from "../types";
import { buildAttentionSummary, formatRelative, healthMeta, jobTypeLabel, shortCommit, toLocale } from "../ui";

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
    return "bg-emerald-50 text-emerald-900 border-emerald-200";
  }
  if (kind === "warn") {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }
  if (kind === "error") {
    return "bg-rose-50 text-rose-900 border-rose-200";
  }
  return "bg-slate-50 text-slate-900 border-slate-200";
}

function eventTone(level: SystemEvent["level"]): string {
  if (level === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (level === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
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
  const recentEvents = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-10);
  const recentApps = [...applications].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className={`rounded-xl border p-5 ${metricTone("neutral")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">登録アプリ</span>
            <FiActivity className="h-5 w-5 text-slate-500" />
          </div>
          <p className="mt-4 text-3xl font-bold">{applications.length}</p>
          <p className="mt-1 text-xs text-slate-500">{system?.applicationSummary.running ?? 0} 件が稼働中</p>
        </article>

        <article className={`rounded-xl border p-5 ${metricTone("ok")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800">正常</span>
            <FiCheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-4 text-3xl font-bold">{healthyCount}</p>
          <p className="mt-1 text-xs text-emerald-600/80">応答とコンテナが安定</p>
        </article>

        <article className={`rounded-xl border p-5 ${metricTone("warn")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-800">要確認</span>
            <FiAlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-4 text-3xl font-bold">{warningCount}</p>
          <p className="mt-1 text-xs text-amber-700/80">遅延・画面確認が必要</p>
        </article>

        <article className={`rounded-xl border p-5 ${metricTone("error")}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-rose-800">異常</span>
            <FiXCircle className="h-5 w-5 text-rose-600" />
          </div>
          <p className="mt-4 text-3xl font-bold">{criticalCount}</p>
          <p className="mt-1 text-xs text-rose-600/80">到達不可・実行エラー</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <article className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">注意が必要なアプリ</h2>
              <p className="mt-0.5 text-xs text-slate-500">対応が推奨されるアプリケーション</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-800"
              onClick={onOpenApplications}
            >
              すべて見る
              <FiArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3">
            {attentionApps.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">優先対応が必要なアプリはありません。</p>
            ) : null}
            {attentionApps.map((application) => {
              const health = healthMeta(application.health);
              return (
                <button
                  key={application.application_id}
                  type="button"
                  className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
                  onClick={() => onOpenDetail(application.application_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-indigo-700">{application.name}</span>
                        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {health.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-sm text-slate-500">{application.hostname}</p>
                    </div>
                    <FiExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-indigo-500" />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-700">{buildAttentionSummary(application)}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{formatRelative(application.updated_at)}</span>
                    <span>{shortCommit(application.current_commit)}</span>
                    {application.health?.response_time_ms ? <span>{application.health.response_time_ms}ms</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <div className="flex flex-col gap-6">
          <article className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">失敗したジョブ</h2>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{failedJobs.length}</span>
            </div>
            <div className="space-y-2">
              {failedJobs.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">失敗ジョブはありません。</p>
              ) : null}
              {failedJobs.map((job) => (
                <div key={job.job_id} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <p className="text-sm font-bold text-slate-900">{job.application_name ?? "システム"}</p>
                  <p className="mt-1 text-xs text-slate-600">{jobTypeLabel(job.type)}</p>
                  {job.message ? <p className="mt-1 line-clamp-2 text-xs text-rose-700">{job.message}</p> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">最近追加されたアプリ</h2>
              <FiClock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="space-y-2">
              {recentApps.map((application) => (
                <button
                  key={application.application_id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50"
                  onClick={() => onOpenDetail(application.application_id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{application.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatRelative(application.created_at)}</p>
                  </div>
                  <FiArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mt-2 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">システムイベント</h2>
            <p className="mt-0.5 text-xs text-slate-500">直近のイベントを発生順に並べています</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          {recentEvents.length === 0 ? <p className="text-sm text-slate-500">イベントはまだありません。</p> : null}
          {recentEvents.length === 0 ? null : (
            <div className="divide-y divide-slate-200">
              {recentEvents.map((event, index) => (
                <article key={event.event_id} className="grid gap-3 px-4 py-4 md:grid-cols-[148px_minmax(0,1fr)] md:px-5">
                  <div className="flex items-start gap-3 md:block">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0 md:hidden">
                        <p className="text-xs font-medium text-slate-500">{toLocale(event.created_at)}</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">{event.scope ?? "system"}</p>
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-xs font-medium text-slate-500">{toLocale(event.created_at)}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{event.scope ?? "system"}</p>
                    </div>
                  </div>

                  <div className="relative min-w-0 pl-5 md:pl-6">
                    <div className="absolute bottom-0 left-[7px] top-0 w-px bg-slate-200 md:left-2" aria-hidden="true" />
                    <div className="absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400 shadow-sm md:left-[1px]" aria-hidden="true" />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{event.title}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          {event.application_name ? <span>{event.application_name}</span> : null}
                          {event.scope ? <span>scope: {event.scope}</span> : null}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${eventTone(event.level)}`}>{event.level}</span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.message}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

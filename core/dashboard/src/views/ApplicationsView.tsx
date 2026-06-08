import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiPauseCircle
} from "react-icons/fi";
import type { ApplicationListItem } from "../types";
import {
  applicationModeLabel,
  applicationStatusMeta,
  buildAttentionSummary,
  buildOperationLockReason,
  formatRelative,
  getActiveJob,
  healthMeta,
  jobStatusLabel,
  jobTypeLabel,
  shortCommit
} from "../ui";

type ApplicationsViewProps = {
  applications: ApplicationListItem[];
  selectedApplicationId: string | null;
  onOpenDetail: (applicationId: string) => void;
};

function healthIcon(severity: string | undefined) {
  if (severity === "ok") {
    return <FiCheckCircle className="h-4 w-4 text-emerald-500" />;
  }
  if (severity === "warning") {
    return <FiAlertTriangle className="h-4 w-4 text-amber-500" />;
  }
  if (severity === "critical") {
    return <FiPauseCircle className="h-4 w-4 text-rose-500" />;
  }
  return <FiClock className="h-4 w-4 text-slate-400" />;
}

export function ApplicationsView(props: ApplicationsViewProps) {
  const { applications, selectedApplicationId, onOpenDetail } = props;

  const runningCount = applications.filter((application) => application.status === "Running").length;
  const updateCount = applications.filter((application) => application.has_update).length;
  const attentionCount = applications.filter((application) => {
    const severity = application.health?.severity;
    return severity === "warning" || severity === "critical" || application.status === "Failed";
  }).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-1">
      <header className="rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f5f7fb_100%)] p-5 shadow-[0_26px_64px_-54px_rgba(15,23,42,0.48)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Applications</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">アプリケーション一覧</h1>
            <p className="mt-2 text-sm text-slate-500">公開中、更新待ち、要確認のアプリを同じ視点で比較できるよう整理しています。</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">登録数</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{applications.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700">稼働中</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{runningCount}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">要確認 / 更新あり</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{attentionCount + updateCount}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {applications.length === 0 ? (
          <article className="col-span-full rounded-[1.6rem] border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            登録されたアプリケーションはありません。
          </article>
        ) : null}

        {applications.map((application) => {
          const status = applicationStatusMeta(application.status);
          const health = healthMeta(application.health);
          const activeJob = getActiveJob(application);
          const lockReason = buildOperationLockReason(application);

          return (
            <article
              key={application.application_id}
              className={`flex flex-col overflow-hidden rounded-[1.7rem] border bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_24px_60px_-52px_rgba(15,23,42,0.48)] transition ${
                selectedApplicationId === application.application_id
                  ? "border-teal-400 ring-2 ring-teal-200"
                  : "border-slate-200 hover:border-teal-200"
              }`}
            >
              <div className="flex-1 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      <FiActivity className="h-3.5 w-3.5" />
                      {applicationModeLabel(application.mode)}
                    </div>
                    <h3 className="mt-2 truncate text-lg font-bold text-slate-950">{application.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                    onClick={() => onOpenDetail(application.application_id)}
                    aria-label={`${application.name} の詳細を開く`}
                  >
                    <FiArrowUpRight className="h-[18px] w-[18px]" />
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {healthIcon(application.health?.severity)}
                    {health.label}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {status.label}
                  </span>
                  {application.has_update ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">更新あり</span>
                  ) : null}
                </div>

                <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-700">{buildAttentionSummary(application)}</p>

                <div className="grid gap-2 rounded-[1.3rem] border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">ホスト</span>
                    <span className="truncate font-mono text-right">{application.hostname}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">更新日時</span>
                    <span>{formatRelative(application.updated_at)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">応答速度</span>
                    <span>{application.health?.response_time_ms ? `${application.health.response_time_ms}ms` : "測定中"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Commit</span>
                    <span>{shortCommit(application.current_commit)}</span>
                  </div>
                </div>

                {activeJob ? (
                  <div className="mt-4 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Active Job</p>
                    <p className="mt-2 text-sm font-semibold text-amber-900">
                      {jobTypeLabel(activeJob.type)} / {jobStatusLabel(activeJob.status)}
                    </p>
                    {activeJob.message ? <p className="mt-2 text-sm leading-6 text-amber-900/80">{activeJob.message}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-4">
                <div className="min-w-0">
                  {lockReason ? (
                    <p className="truncate text-xs font-semibold text-amber-700">{lockReason}</p>
                  ) : (
                    <p className="truncate text-xs text-slate-500">{status.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                    href={`http://${application.hostname}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiExternalLink className="h-4 w-4" />
                    <span className="hidden sm:inline">開く</span>
                  </a>
                  <button
                    type="button"
                    className="rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    onClick={() => onOpenDetail(application.application_id)}
                  >
                    管理
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

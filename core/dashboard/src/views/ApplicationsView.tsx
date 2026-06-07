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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">アプリケーション一覧</h1>
          <p className="mt-1 text-sm text-slate-500">システムに登録されたすべてのアプリケーション</p>
        </div>
        <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
          {applications.length} 件
        </span>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {applications.length === 0 ? (
          <article className="col-span-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
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
              className={`flex flex-col rounded-xl border bg-white transition hover:shadow-md ${
                selectedApplicationId === application.application_id
                  ? "border-indigo-500 ring-1 ring-indigo-500"
                  : "border-slate-200"
              }`}
            >
              <div className="flex-1 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase">
                      <FiActivity className="h-3.5 w-3.5" />
                      {applicationModeLabel(application.mode)}
                    </div>
                    <h3 className="mt-1 truncate text-lg font-bold text-slate-900">{application.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
                    onClick={() => onOpenDetail(application.application_id)}
                    aria-label={`${application.name} の詳細を開く`}
                  >
                    <FiArrowUpRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                    {healthIcon(application.health?.severity)}
                    {health.label}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                    {status.label}
                  </span>
                  {application.has_update ? (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">更新あり</span>
                  ) : null}
                </div>

                <p className="mb-4 line-clamp-3 text-sm text-slate-700">{buildAttentionSummary(application)}</p>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-1">
                    <span className="text-slate-400">ホスト</span>
                    <span className="truncate font-mono">{application.hostname}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-1">
                    <span className="text-slate-400">更新日時</span>
                    <span>{formatRelative(application.updated_at)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-1">
                    <span className="text-slate-400">応答速度</span>
                    <span>{application.health?.response_time_ms ? `${application.health.response_time_ms}ms` : "測定中"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Commit</span>
                    <span>{shortCommit(application.current_commit)}</span>
                  </div>
                </div>

                {activeJob ? (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-xs font-bold text-indigo-800">実行中のジョブ</p>
                    <p className="mt-1 text-sm font-medium text-indigo-900">
                      {jobTypeLabel(activeJob.type)} / {jobStatusLabel(activeJob.status)}
                    </p>
                    {activeJob.message ? <p className="mt-1 text-sm text-indigo-900/80">{activeJob.message}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-slate-50 p-4">
                <div className="min-w-0">
                  {lockReason ? (
                    <p className="truncate text-xs font-medium text-amber-600">{lockReason}</p>
                  ) : (
                    <p className="truncate text-xs text-slate-500">{status.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    href={`http://${application.hostname}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiExternalLink className="h-4 w-4" />
                    <span className="hidden sm:inline">開く</span>
                  </a>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
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

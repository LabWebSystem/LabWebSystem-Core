import { FiActivity, FiAlertTriangle, FiArrowUpRight, FiCheckCircle, FiClock, FiExternalLink, FiLayers, FiPauseCircle } from "react-icons/fi";
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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            <FiLayers className="h-4 w-4" />
            Applications
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">登録アプリ</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{applications.length} 件</span>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {applications.length === 0 ? (
          <article className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500">
            登録されたアプリはありません。
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
              className={`rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                selectedApplicationId === application.application_id
                  ? "border-slate-900 ring-2 ring-slate-900/5"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    <FiActivity className="h-3.5 w-3.5" />
                    {applicationModeLabel(application.mode)}
                  </div>
                  <h3 className="mt-2 truncate text-lg font-semibold text-slate-950">{application.name}</h3>
                  <p className="mt-1 truncate text-sm text-slate-500">{application.hostname}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => onOpenDetail(application.application_id)}
                  aria-label={`${application.name} の詳細を開く`}
                >
                  <FiArrowUpRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                  {healthIcon(application.health?.severity)}
                  {health.label}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{status.label}</span>
                {application.has_update ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">更新あり</span>
                ) : null}
              </div>

              <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-700">{buildAttentionSummary(application)}</p>

              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Commit</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{shortCommit(application.current_commit)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Updated</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{formatRelative(application.updated_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Response</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{application.health?.response_time_ms ? `${application.health.response_time_ms}ms` : "監視中"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Route</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{application.public_service_name}:{application.public_port}</dd>
                </div>
              </dl>

              {activeJob ? (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Now</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {jobTypeLabel(activeJob.type)} / {jobStatusLabel(activeJob.status)}
                  </p>
                  {activeJob.message ? <p className="mt-1 text-sm text-slate-700">{activeJob.message}</p> : null}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {lockReason ? <p className="truncate text-xs text-amber-700">{lockReason}</p> : <p className="truncate text-xs text-slate-500">{status.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    href={`http://${application.hostname}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiExternalLink className="h-4 w-4" />
                    公開
                  </a>
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    onClick={() => onOpenDetail(application.application_id)}
                  >
                    詳細
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

import { FiAlertCircle, FiClock, FiLoader, FiPlayCircle, FiRefreshCw, FiX } from "react-icons/fi";
import type { ApplicationJob } from "../types";
import { formatElapsed, formatRelative, jobStatusLabel, jobTypeLabel, toLocale } from "../ui";

type JobsPanelProps = {
  open: boolean;
  jobs: ApplicationJob[];
  onClose: () => void;
  onOpenDetail: (applicationId: string) => void;
  onRetryJob: (jobId: string, typeLabel: string) => void;
  onCancelJob: (jobId: string) => void;
};

function statusIcon(status: ApplicationJob["status"]) {
  if (status === "running") {
    return <FiLoader className="h-4 w-4 animate-spin" />;
  }
  if (status === "queued") {
    return <FiClock className="h-4 w-4" />;
  }
  if (status === "failed") {
    return <FiAlertCircle className="h-4 w-4" />;
  }
  return <FiPlayCircle className="h-4 w-4" />;
}

function statusTone(status: ApplicationJob["status"]): string {
  if (status === "running") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "queued") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (status === "cancelled") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export function JobsPanel(props: JobsPanelProps) {
  const { open, jobs, onClose, onOpenDetail, onRetryJob, onCancelJob } = props;

  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const recentJobs = jobs.slice(0, 24);

  return (
    <>
      <button
        type="button"
        aria-label="ジョブパネルを閉じる"
        className={`fixed inset-0 z-40 bg-slate-950/35 transition ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[430px] flex-col border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Jobs</p>
            <h2 className="text-lg font-semibold text-slate-900">ジョブ一覧</h2>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">実行中・待機中</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{activeJobs.length}</span>
            </div>
            {activeJobs.length === 0 ? <p className="text-sm text-slate-500">進行中のジョブはありません。</p> : null}
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <article key={job.job_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {statusIcon(job.status)}
                        <span>{jobTypeLabel(job.type)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-600">{job.application_name ?? "システム"}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(job.status)}`}>
                      {jobStatusLabel(job.status)}
                    </span>
                  </div>
                  {job.message ? <p className="mt-3 text-sm leading-6 text-slate-700">{job.message}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>作成 {formatRelative(job.created_at)}</span>
                    <span>経過 {formatElapsed(job.started_at ?? job.created_at, job.finished_at)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.related_application_id ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        onClick={() => onOpenDetail(job.related_application_id as string)}
                      >
                        対象アプリ
                      </button>
                    ) : null}
                    {job.cancellable ? (
                      <button
                        type="button"
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                        onClick={() => onCancelJob(job.job_id)}
                      >
                        待機を取り消す
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">失敗ジョブ</h3>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">{failedJobs.length}</span>
            </div>
            {failedJobs.length === 0 ? <p className="text-sm text-slate-500">再実行待ちの失敗ジョブはありません。</p> : null}
            <div className="space-y-3">
              {failedJobs.slice(0, 8).map((job) => (
                <article key={job.job_id} className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <FiAlertCircle className="h-4 w-4 text-rose-600" />
                        <span>{jobTypeLabel(job.type)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-600">{job.application_name ?? "システム"}</p>
                    </div>
                    <span className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700">
                      {jobStatusLabel(job.status)}
                    </span>
                  </div>
                  {job.message ? <p className="mt-3 text-sm leading-6 text-slate-700">{job.message}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{toLocale(job.finished_at ?? job.created_at)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.related_application_id ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                        onClick={() => onOpenDetail(job.related_application_id as string)}
                      >
                        対象アプリ
                      </button>
                    ) : null}
                    {job.retryable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
                        onClick={() => onRetryJob(job.job_id, jobTypeLabel(job.type))}
                      >
                        <FiRefreshCw className="h-4 w-4" />
                        再実行
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">最近のジョブ</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{recentJobs.length}</span>
            </div>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div key={job.job_id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {job.application_name ?? "システム"} / {jobTypeLabel(job.type)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatRelative(job.created_at)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(job.status)}`}>
                    {jobStatusLabel(job.status)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

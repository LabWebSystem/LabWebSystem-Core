import { useMemo } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock, FiLoader, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";
import type { ApplicationJob } from "../types";
import { canCancelJob, canDeleteJob, canRetryJob, formatElapsed, formatRelative, jobStatusLabel, jobTypeLabel } from "../ui";

type JobsPanelProps = {
  open: boolean;
  jobs: ApplicationJob[];
  onClose: () => void;
  onOpenDetail: (applicationId: string) => void;
  onRetryJob: (jobId: string, typeLabel: string) => void;
  onCancelJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
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
  if (status === "succeeded") {
    return <FiCheckCircle className="h-4 w-4" />;
  }

  return <FiX className="h-4 w-4" />;
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

function buildSummary(job: ApplicationJob): string {
  if (job.message && job.message.trim().length > 0) {
    return job.message.trim();
  }
  return `${jobTypeLabel(job.type)} ジョブです。`;
}

export function JobsPanel(props: JobsPanelProps) {
  const { open, jobs, onClose, onOpenDetail, onRetryJob, onCancelJob, onDeleteJob } = props;

  const summary = useMemo(() => {
    return {
      queued: jobs.filter((job) => job.status === "queued").length,
      running: jobs.filter((job) => job.status === "running").length,
      failed: jobs.filter((job) => job.status === "failed").length
    };
  }, [jobs]);

  return (
    <>
      <button
        type="button"
        aria-label="ジョブパネルを閉じる"
        className={`fixed inset-0 z-40 bg-slate-950/35 transition ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Queue</p>
            <h2 className="text-lg font-semibold text-slate-900">ジョブキュー</h2>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">待機 {summary.queued}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">実行中 {summary.running}</span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">失敗 {summary.failed}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {jobs.length === 0 ? <p className="text-sm text-slate-500">キューにジョブはありません。</p> : null}
            {jobs.map((job) => (
              <article key={job.job_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {statusIcon(job.status)}
                      <span>{jobTypeLabel(job.type)}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-slate-600">{job.application_name ?? "システム"}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(job.status)}`}>
                    {jobStatusLabel(job.status)}
                  </span>
                </div>

                <p className="mt-3 line-clamp-4 break-words text-sm leading-6 text-slate-700">{buildSummary(job)}</p>

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
                  {canCancelJob(job) ? (
                    <button
                      type="button"
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                      onClick={() => onCancelJob(job.job_id)}
                    >
                      取り消す
                    </button>
                  ) : null}
                  {canRetryJob(job) ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
                      onClick={() => onRetryJob(job.job_id, jobTypeLabel(job.type))}
                    >
                      <FiRefreshCw className="h-4 w-4" />
                      再実行
                    </button>
                  ) : null}
                  {canDeleteJob(job) ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      onClick={() => onDeleteJob(job.job_id)}
                    >
                      <FiTrash2 className="h-4 w-4" />
                      削除
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

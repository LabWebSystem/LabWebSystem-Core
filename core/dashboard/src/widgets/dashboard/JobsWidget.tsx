import { WidgetFrame } from "./WidgetFrame";
import { formatRelative, jobStatusLabel, jobTypeLabel } from "../../ui";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { ApplicationJob } from "../../types";

export function JobsWidget(props: { frameProps: DashboardWidgetFrameProps; jobs: ApplicationJob[] }) {
  const { frameProps, jobs } = props;
  const shownJobs = jobs.slice(0, frameProps.mode === "compact" ? 4 : frameProps.mode === "detail" ? 10 : 6);

  return (
    <WidgetFrame {...frameProps}>
      <div className={`h-full overflow-y-auto pr-1 ${frameProps.mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
        {shownJobs.map((job) => (
          <div key={job.job_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">{jobTypeLabel(job.type)}</p>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{jobStatusLabel(job.status)}</span>
            </div>
            {frameProps.mode !== "compact" ? (
              <>
                <p className="mt-1 text-xs text-slate-400">{job.application_name ?? "system"} / {formatRelative(job.created_at)}</p>
                {job.message ? <p className={`mt-2 text-sm text-slate-600 ${frameProps.mode === "detail" ? "line-clamp-3" : "line-clamp-2"}`}>{job.message}</p> : null}
              </>
            ) : null}
          </div>
        ))}
        {shownJobs.length === 0 ? <p className="text-sm text-slate-400">ジョブはありません。</p> : null}
      </div>
    </WidgetFrame>
  );
}

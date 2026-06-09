import { WidgetFrame } from "./WidgetFrame";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { ApplicationJob, ApplicationListItem, DashboardMetrics, SystemStatus } from "../../types";

type StatusWidgetProps = {
  frameProps: DashboardWidgetFrameProps;
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  metrics: DashboardMetrics | null;
  dashboardPageCount: number;
  dashboardWidgetCount: number;
};

export function StatusWidget(props: StatusWidgetProps) {
  const { frameProps, system, applications, jobs, metrics, dashboardPageCount, dashboardWidgetCount } = props;
  const { mode } = frameProps;

  const summaryCards = [
    {
      label: "Apps",
      value: system?.applicationSummary.total ?? applications.length,
      tone: "border-slate-200 bg-slate-50",
      textTone: "text-slate-900",
      meta: `登録 ${applications.length}`
    },
    {
      label: "Healthy",
      value: applications.filter((application) => application.health?.severity === "ok").length,
      tone: "border-emerald-200 bg-emerald-50",
      textTone: "text-emerald-900",
      meta: "安定稼働"
    },
    {
      label: "Queue",
      value: jobs.filter((job) => job.status !== "succeeded").length,
      tone: "border-amber-200 bg-amber-50",
      textTone: "text-amber-900",
      meta: "待機・要確認"
    },
    {
      label: "Pages",
      value: dashboardPageCount,
      tone: "border-violet-200 bg-violet-50",
      textTone: "text-violet-900",
      meta: `widgets ${dashboardWidgetCount}`
    }
  ];

  return (
    <WidgetFrame {...frameProps}>
      <div className={`grid h-full gap-3 ${mode === "compact" ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
            <p className={`mt-3 ${mode === "detail" ? "text-4xl" : "text-3xl"} font-bold ${card.textTone}`}>{card.value}</p>
            {mode !== "compact" ? <p className="mt-2 text-sm text-slate-500">{card.meta}</p> : null}
          </div>
        ))}
      </div>
      {mode === "detail" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            実行モード: <span className="font-semibold text-slate-900">{system?.execution?.mode ?? "unknown"}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            DNS: <span className="font-semibold text-slate-900">{metrics?.network.dnsEnabled ? "enabled" : "disabled"}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Root Domain: <span className="font-mono text-slate-900">{metrics?.network.rootDomain ?? "--"}</span>
          </div>
        </div>
      ) : null}
    </WidgetFrame>
  );
}

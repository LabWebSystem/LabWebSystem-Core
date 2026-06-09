import { WidgetFrame } from "./WidgetFrame";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { ApplicationJob, ApplicationListItem, DashboardMetrics, SystemStatus } from "../../types";

type StatusWidgetProps = {
  frameProps: DashboardWidgetFrameProps;
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  metrics: DashboardMetrics | null;
};

export function StatusWidget(props: StatusWidgetProps) {
  const { frameProps, system, applications, jobs, metrics } = props;
  const { mode } = frameProps;
  const alertingApplications = applications.filter(
    (application) => application.health?.severity === "critical" || Boolean(application.latest_error_title)
  ).length;
  const cardPadding = mode === "compact" ? "p-3" : "p-4";
  const labelClass = mode === "compact" ? "text-[10px]" : "text-xs";
  const valueClass = mode === "detail" ? "text-4xl" : mode === "compact" ? "text-2xl" : "text-3xl";
  const metaClass = mode === "compact" ? "text-xs" : "text-sm";
  const gridClass =
    mode === "detail"
      ? "grid-cols-2 xl:grid-cols-4"
      : "grid-cols-2";

  const summaryCards = [
    {
      label: "アプリ",
      value: system?.applicationSummary.total ?? applications.length,
      tone: "border-slate-200 bg-slate-50",
      textTone: "text-slate-900",
      meta: `登録 ${applications.length}`
    },
    {
      label: "正常",
      value: applications.filter((application) => application.health?.severity === "ok").length,
      tone: "border-emerald-200 bg-emerald-50",
      textTone: "text-emerald-900",
      meta: "安定稼働"
    },
    {
      label: "ジョブ",
      value: jobs.filter((job) => job.status !== "succeeded").length,
      tone: "border-amber-200 bg-amber-50",
      textTone: "text-amber-900",
      meta: "待機・要確認"
    },
    {
      label: "異常",
      value: alertingApplications,
      tone: "border-rose-200 bg-rose-50",
      textTone: "text-rose-900",
      meta: "アラート発生中のアプリ"
    }
  ];

  return (
    <WidgetFrame {...frameProps}>
      <div className={`grid h-full auto-rows-fr gap-3 ${gridClass}`}>
        {summaryCards.map((card) => (
          <div key={card.label} className={`flex min-h-0 flex-col justify-between rounded-2xl border ${cardPadding} ${card.tone}`}>
            <p className={`${labelClass} font-semibold uppercase tracking-[0.2em] text-slate-400`}>{card.label}</p>
            <div className="mt-2 min-h-0">
              <p className={`${valueClass} font-bold ${card.textTone}`}>{card.value}</p>
              <p className={`mt-1 line-clamp-2 ${metaClass} ${card.label === "異常" ? "text-rose-700" : "text-slate-500"}`}>{card.meta}</p>
            </div>
          </div>
        ))}
      </div>
      {mode === "detail" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            実行モード: <span className="font-semibold text-slate-900">{system?.execution?.mode ?? "不明"}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            DNS: <span className="font-semibold text-slate-900">{metrics?.network.dnsEnabled ? "有効" : "無効"}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ルートドメイン: <span className="font-mono text-slate-900">{metrics?.network.rootDomain ?? "--"}</span>
          </div>
        </div>
      ) : null}
    </WidgetFrame>
  );
}

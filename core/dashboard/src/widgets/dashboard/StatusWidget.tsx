import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { ApplicationJob, ApplicationListItem, DashboardMetrics, SystemStatus } from "../../types";

import { WidgetFrame } from "./WidgetFrame";

type StatusWidgetProps = {
  frameProps: DashboardWidgetFrameProps;
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  metrics: DashboardMetrics | null;
};

type SummaryCard = {
  label: string;
  value: number;
  tone: string;
  textTone: string;
  meta: string;
};

export function StatusWidget(props: StatusWidgetProps) {
  const { frameProps, system, applications, jobs, metrics } = props;
  const { mode } = frameProps;

  const alertingApplications = applications.filter(
    (application) => application.health?.severity === "critical" || Boolean(application.latest_error_title)
  ).length;

  const summaryCards: SummaryCard[] = [
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
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="grid h-full min-h-0 min-w-0 grid-cols-[repeat(4,minmax(0,1fr))] grid-rows-1 gap-[clamp(0.25rem,0.8vw,0.75rem)] overflow-hidden">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`flex min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-2xl border ${card.tone}`}
              style={{
                padding: mode === "compact" ? "clamp(0.45rem, 1.1vw, 0.75rem)" : "clamp(0.5rem, 1.3vw, 1rem)"
              }}
            >
              <p className="min-w-0 truncate text-[clamp(0.55rem,0.75vw,0.75rem)] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {card.label}
              </p>

              <div className="mt-1 min-h-0 min-w-0">
                <p
                  className={`min-w-0 truncate font-bold leading-none ${card.textTone}`}
                  style={{
                    fontSize:
                      mode === "detail"
                        ? "clamp(1.4rem, 2.8vw, 2.25rem)"
                        : mode === "compact"
                          ? "clamp(1rem, 2.2vw, 1.5rem)"
                          : "clamp(1.2rem, 2.5vw, 1.875rem)"
                  }}
                >
                  {card.value}
                </p>

                <p
                  className={`mt-1 min-w-0 truncate text-[clamp(0.55rem,0.85vw,0.875rem)] leading-tight ${card.label === "異常" ? "text-rose-700" : "text-slate-500"
                    }`}
                  title={card.meta}
                >
                  {card.meta}
                </p>
              </div>
            </div>
          ))}
        </div>

        {mode === "detail" ? (
          <div className="mt-3 grid min-h-0 shrink-0 gap-3 sm:grid-cols-3">
            <div className="truncate rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              実行モード:{" "}
              <span className="font-semibold text-slate-900">
                {system?.execution?.mode ?? "不明"}
              </span>
            </div>

            <div className="truncate rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              DNS:{" "}
              <span className="font-semibold text-slate-900">
                {metrics?.network.dnsEnabled ? "有効" : "無効"}
              </span>
            </div>

            <div className="truncate rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              ルートドメイン:{" "}
              <span className="font-mono text-slate-900">
                {metrics?.network.rootDomain ?? "--"}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </WidgetFrame>
  );
}
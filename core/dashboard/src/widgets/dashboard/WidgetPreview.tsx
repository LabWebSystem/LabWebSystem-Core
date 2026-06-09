import { FaChartLine } from "react-icons/fa6";
import { sparklinePath } from "../../dashboard/utils";
import { widgetIcon, widgetLabel } from "../../dashboard/widgetDefinitions";
import type { DashboardWidgetType } from "../../types";

function PreviewMetric(props: { type: DashboardWidgetType; accentClass: string }) {
  const { type, accentClass } = props;
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-2xl bg-slate-100 p-2.5 text-slate-600">{widgetIcon(type, "text-base")}</span>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{widgetLabel(type)}</p>
          <p className="text-2xl font-bold text-slate-900">63%</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: "63%" }} />
      </div>
    </div>
  );
}

export function WidgetPreview(props: { type: DashboardWidgetType }) {
  const { type } = props;

  switch (type) {
    case "status":
      return (
        <div className="grid h-full grid-cols-2 gap-2">
          {[
            ["Apps", "12"],
            ["Healthy", "10"],
            ["Queue", "3"],
            ["Pages", "4"]
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`rounded-xl border p-3 ${
                index === 1
                  ? "border-emerald-200 bg-emerald-50"
                  : index === 2
                    ? "border-amber-200 bg-amber-50"
                    : index === 3
                      ? "border-violet-200 bg-violet-50"
                      : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      );
    case "cpu":
      return <PreviewMetric type={type} accentClass="bg-emerald-500" />;
    case "memory":
      return <PreviewMetric type={type} accentClass="bg-violet-500" />;
    case "disk":
      return <PreviewMetric type={type} accentClass="bg-amber-500" />;
    case "network":
      return (
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="rounded-2xl bg-slate-100 p-2.5 text-slate-600">{widgetIcon(type, "text-base")}</span>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">4</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">interfaces</p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-500">
            <div className="flex justify-between gap-2">
              <span>primary</span>
              <span className="font-mono text-slate-700">192.168.0.10</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>dns</span>
              <span className="font-semibold text-slate-700">enabled</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>domain</span>
              <span className="font-mono text-slate-700">lab.local</span>
            </div>
          </div>
        </div>
      );
    case "chart":
      return (
        <div className="flex h-full flex-col">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">trend</p>
            <FaChartLine className="text-slate-400" />
          </div>
          <div className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <svg viewBox="0 0 240 80" className="h-full w-full">
              <path d={sparklinePath([22, 38, 34, 44, 42, 58], 240, 80)} fill="none" stroke="#10b981" strokeWidth="3" />
              <path d={sparklinePath([12, 16, 28, 26, 34, 39], 240, 80)} fill="none" stroke="#8b5cf6" strokeWidth="3" />
              <path d={sparklinePath([48, 44, 50, 56, 52, 60], 240, 80)} fill="none" stroke="#f59e0b" strokeWidth="3" />
            </svg>
          </div>
        </div>
      );
    case "alert":
    case "applications":
    case "jobs":
    case "events":
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="h-2.5 w-20 rounded-full bg-slate-300" />
                <div className="h-2.5 w-10 rounded-full bg-white" />
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200" />
              <div className="mt-1.5 h-2.5 w-3/4 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      );
    case "log":
      return (
        <div className="flex h-full flex-col">
          <div className="mb-2 flex gap-2">
            <div className="h-8 flex-1 rounded-xl border border-slate-200 bg-white" />
            <div className="h-8 w-24 rounded-xl border border-slate-200 bg-white" />
          </div>
          <div className="min-h-0 flex-1 rounded-xl bg-slate-950 p-3 font-mono text-[10px] text-slate-300">
            <div className="space-y-1">
              <div>{"> boot sequence started"}</div>
              <div>{"> healthcheck ok"}</div>
              <div>{"> worker queue idle"}</div>
              <div>{"> waiting for next task"}</div>
            </div>
          </div>
        </div>
      );
    default:
      return <div className="text-sm text-slate-400">preview</div>;
  }
}

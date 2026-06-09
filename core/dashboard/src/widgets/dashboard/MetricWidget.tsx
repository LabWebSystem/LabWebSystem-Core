import { gaugeTone } from "../../dashboard/utils";
import type { WidgetVisualMode } from "../../dashboard/types";

type MetricWidgetProps = {
  icon: React.ReactNode;
  value: number;
  label: string;
  meta: string;
  mode: WidgetVisualMode;
  detailItems?: string[];
};

export function MetricWidget(props: MetricWidgetProps) {
  const { icon, value, label, meta, mode, detailItems = [] } = props;
  const valueClass = mode === "compact" ? "text-2xl" : mode === "detail" ? "text-4xl" : "text-3xl";
  const iconPadding = mode === "detail" ? "p-3.5" : "p-3";

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-2xl bg-slate-100 text-slate-600 ${iconPadding}`}>{icon}</span>
        <div className="min-w-0 text-right">
          {mode !== "compact" ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p> : null}
          <p className={`${valueClass} font-bold text-slate-900`}>{value.toFixed(1)}%</p>
          <p className={`mt-1 ${mode === "compact" ? "text-xs text-slate-500" : "text-sm text-slate-500"}`}>
            {mode === "compact" ? label : meta}
          </p>
        </div>
      </div>

      {mode === "detail" && detailItems.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {detailItems.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {item}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${gaugeTone(value)}`} style={{ width: `${Math.max(8, value)}%` }} />
      </div>
    </div>
  );
}

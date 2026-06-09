import { WidgetFrame } from "./WidgetFrame";
import { toLocale } from "../../ui";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { DashboardMetrics } from "../../types";

type AlertWidgetProps = {
  frameProps: DashboardWidgetFrameProps;
  metrics: DashboardMetrics | null;
  onOpenEvents: () => void;
};

export function AlertWidget(props: AlertWidgetProps) {
  const { frameProps, metrics, onOpenEvents } = props;
  const items = (metrics?.alerts ?? []).slice(0, frameProps.mode === "compact" ? 3 : frameProps.mode === "detail" ? 8 : 5);

  return (
    <WidgetFrame {...frameProps}>
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">warning / error</p>
          <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenEvents}>
            すべて見る
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${frameProps.mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
          {items.map((alert) => (
            <div key={alert.event_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    alert.level === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {alert.level}
                </span>
                <span className="text-[11px] text-slate-400">{toLocale(alert.created_at)}</span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">{alert.title}</p>
              {frameProps.mode !== "compact" ? (
                <p className={`mt-1 whitespace-pre-wrap text-sm text-slate-600 ${frameProps.mode === "detail" ? "line-clamp-4" : "line-clamp-2"}`}>
                  {alert.message}
                </p>
              ) : null}
            </div>
          ))}
          {items.length === 0 ? <p className="text-sm text-slate-400">現在アラートはありません。</p> : null}
        </div>
      </div>
    </WidgetFrame>
  );
}

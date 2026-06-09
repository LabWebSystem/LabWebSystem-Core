import { WidgetFrame } from "./WidgetFrame";
import { toLocale } from "../../ui";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { SystemEvent } from "../../types";

export function EventsWidget(props: { frameProps: DashboardWidgetFrameProps; events: SystemEvent[] }) {
  const { frameProps, events } = props;
  const shownEvents = events.slice(0, frameProps.mode === "compact" ? 4 : frameProps.mode === "detail" ? 10 : 6);

  return (
    <WidgetFrame {...frameProps}>
      <div className={`h-full overflow-y-auto pr-1 ${frameProps.mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
        {shownEvents.map((event) => (
          <div key={event.event_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">{event.title}</p>
              {frameProps.mode !== "compact" ? <span className="text-[11px] text-slate-400">{toLocale(event.created_at)}</span> : null}
            </div>
            {frameProps.mode !== "compact" ? (
              <>
                <p className="mt-1 text-xs text-slate-400">{event.application_name ?? event.scope ?? "system"}</p>
                <p className={`mt-2 whitespace-pre-wrap text-sm text-slate-600 ${frameProps.mode === "detail" ? "line-clamp-4" : "line-clamp-2"}`}>{event.message}</p>
              </>
            ) : null}
          </div>
        ))}
        {shownEvents.length === 0 ? <p className="text-sm text-slate-400">イベントはありません。</p> : null}
      </div>
    </WidgetFrame>
  );
}

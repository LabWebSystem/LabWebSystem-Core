import { WidgetPreview } from "./WidgetPreview";
import { formatGridSize, widgetDefinition, widgetIcon, widgetSizing } from "../../dashboard/widgetDefinitions";
import type { DashboardBreakpoint, DashboardWidgetType } from "../../types";

type WidgetPreviewCardProps = {
  type: DashboardWidgetType;
  breakpoint: DashboardBreakpoint;
  targetLabel: string;
  onSelect: (type: DashboardWidgetType) => void;
};

export function WidgetPreviewCard(props: WidgetPreviewCardProps) {
  const { type, breakpoint, targetLabel, onSelect } = props;
  const definition = widgetDefinition(type);
  const size = widgetSizing(type, breakpoint);

  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-white p-3 text-slate-600 shadow-sm">{widgetIcon(type)}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{definition.label}</p>
            <p className="mt-1 text-xs text-slate-500">{definition.description}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">{targetLabel}</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">default</p>
          <p className="text-sm font-bold text-slate-900">{formatGridSize(size.w, size.h)}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">minimum</p>
          <p className="text-sm font-bold text-slate-700">{formatGridSize(size.minW, size.minH)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.4rem] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="mx-auto w-full max-w-[240px]" style={{ aspectRatio: `${size.w} / ${Math.max(size.h, 1)}` }}>
          <div className="h-full overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white p-3 shadow-sm">
            <WidgetPreview type={type} />
          </div>
        </div>
      </div>
    </button>
  );
}

import { WidgetPreviewCard } from "../widgets/dashboard/WidgetPreviewCard";
import { WIDGET_ORDER } from "../dashboard/widgetDefinitions";
import type { DashboardBreakpoint, DashboardWidgetType } from "../types";

type WidgetPickerModalProps = {
  breakpoint: DashboardBreakpoint;
  onClose: () => void;
  onSelect: (type: DashboardWidgetType) => void;
};

export function WidgetPickerModal(props: WidgetPickerModalProps) {
  const { breakpoint, onClose, onSelect } = props;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Add Widget</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">追加前に、実際のサイズと UI を見ながら選択</h3>
            <p className="mt-1 text-sm text-slate-500">表示中の幅 `{breakpoint}` を基準に、デフォルトサイズと最小サイズを `n×m` で表示します。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            閉じる
          </button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {WIDGET_ORDER.map((type) => (
            <WidgetPreviewCard
              key={type}
              type={type}
              breakpoint={breakpoint}
              targetLabel="現在のページに追加"
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

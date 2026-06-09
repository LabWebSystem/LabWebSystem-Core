import { WidgetPreviewCard } from "../widgets/dashboard/WidgetPreviewCard";
import { WIDGET_ORDER, pageBadgeLabel } from "../dashboard/widgetDefinitions";
import type { WidgetPickerTarget } from "../dashboard/types";
import type { DashboardBreakpoint, DashboardWidgetType } from "../types";

type WidgetPickerModalProps = {
  breakpoint: DashboardBreakpoint;
  currentPageIndex: number;
  target: WidgetPickerTarget;
  onTargetChange: (target: WidgetPickerTarget) => void;
  onClose: () => void;
  onSelect: (type: DashboardWidgetType) => void;
};

export function WidgetPickerModal(props: WidgetPickerModalProps) {
  const { breakpoint, currentPageIndex, target, onTargetChange, onClose, onSelect } = props;

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

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTargetChange("current")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              target === "current" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            現在の {pageBadgeLabel(currentPageIndex)} に追加
          </button>
          <button
            type="button"
            onClick={() => onTargetChange("new-page")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              target === "new-page" ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            新しいページを作成して追加
          </button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {WIDGET_ORDER.map((type) => (
            <WidgetPreviewCard
              key={type}
              type={type}
              breakpoint={breakpoint}
              targetLabel={target === "current" ? `${pageBadgeLabel(currentPageIndex)} に追加` : "新しいページに追加"}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

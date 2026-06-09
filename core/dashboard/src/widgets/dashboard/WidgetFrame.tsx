import { FaArrowDown, FaArrowUp, FaTrashCan } from "react-icons/fa6";
import { formatGridSize, modeLabel, pageBadgeLabel, widgetSizing } from "../../dashboard/widgetDefinitions";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";

type WidgetFrameProps = DashboardWidgetFrameProps & {
  children: React.ReactNode;
};

export function WidgetFrame(props: WidgetFrameProps) {
  const { widget, mode, editMode, layout, pageIndex, totalPages, breakpoint, onDelete, onMovePage, children } = props;
  const fallbackSize = widgetSizing(widget.type, breakpoint);
  const currentSize = formatGridSize(layout?.w ?? fallbackSize.w, layout?.h ?? fallbackSize.h);
  const minimumSize = formatGridSize(layout?.minW ?? fallbackSize.minW, layout?.minH ?? fallbackSize.minH);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(15,23,42,0.45)]">
      <div className="widget-drag-handle flex cursor-grab items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 active:cursor-grabbing">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{widget.title}</p>
          <p className="truncate text-[11px] uppercase tracking-[0.2em] text-slate-400">
            {pageBadgeLabel(pageIndex)} · {modeLabel(mode)} · {currentSize} / min {minimumSize}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {editMode ? (
            <>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                onClick={() => onMovePage(widget.id, -1)}
                disabled={pageIndex <= 0}
                title="前のページへ移動"
              >
                <FaArrowUp />
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-xs text-slate-500 transition hover:bg-slate-50"
                onClick={() => onMovePage(widget.id, 1)}
                title={pageIndex >= totalPages - 1 ? "新しいページを作成して移動" : "次のページへ移動"}
              >
                <FaArrowDown />
              </button>
            </>
          ) : null}
          {!widget.static ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 p-2 text-xs text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              onClick={() => onDelete(widget.id)}
              title="ウィジェットを削除"
            >
              <FaTrashCan />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">{children}</div>
    </div>
  );
}

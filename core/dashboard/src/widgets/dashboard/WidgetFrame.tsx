import { FaTrashCan } from "react-icons/fa6";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";

type WidgetFrameProps = DashboardWidgetFrameProps & {
  children: React.ReactNode;
};

export function WidgetFrame(props: WidgetFrameProps) {
  const { widget, editMode, onDelete, children } = props;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(15,23,42,0.45)]">
      <div
        className={`widget-drag-handle flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 ${
          editMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{widget.title}</p>
        </div>

        <div className="flex items-center gap-1">
          {editMode ? (
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

import { FaClockRotateLeft } from "react-icons/fa6";
import type { SystemEvent } from "../types";
import { toLocale } from "../ui";

type EventsViewProps = {
  events: SystemEvent[];
};

function levelTone(level: SystemEvent["level"]): string {
  if (level === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (level === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function EventsView(props: EventsViewProps) {
  const { events } = props;
  const orderedEvents = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <FaClockRotateLeft className="text-base text-slate-400" />
          イベント履歴
        </h2>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/70">
            <tr className="text-left text-sm font-bold uppercase tracking-wider text-slate-400">
              <th className="px-6 py-4">時間</th>
              <th className="px-6 py-4">レベル</th>
              <th className="px-6 py-4">対象アプリケーション</th>
              <th className="px-6 py-4">イベント内容</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {orderedEvents.map((event) => (
              <tr key={event.event_id}>
                <td className="px-6 py-4 whitespace-nowrap text-slate-500">{toLocale(event.created_at)}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${levelTone(event.level)}`}>{event.level}</span>
                </td>
                <td className="px-6 py-4 text-slate-600">{event.application_name ?? "-"}</td>
                <td className="px-6 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{event.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">{event.message}</p>
                  </div>
                </td>
              </tr>
            ))}
            {orderedEvents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">
                  イベントはまだありません
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

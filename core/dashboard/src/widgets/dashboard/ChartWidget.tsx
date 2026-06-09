import { FaChartLine } from "react-icons/fa6";
import { WidgetFrame } from "./WidgetFrame";
import { sparklinePath } from "../../dashboard/utils";
import type { DashboardWidgetFrameProps, MetricsHistory } from "../../dashboard/types";

export function ChartWidget(props: { frameProps: DashboardWidgetFrameProps; metricsHistory: MetricsHistory[] }) {
  const { frameProps, metricsHistory } = props;
  const chartPathCpu = sparklinePath(metricsHistory.map((item) => item.cpu), 320, 96);
  const chartPathMemory = sparklinePath(metricsHistory.map((item) => item.memory), 320, 96);
  const chartPathDisk = sparklinePath(metricsHistory.map((item) => item.disk), 320, 96);
  const latest = metricsHistory.at(-1);

  return (
    <WidgetFrame {...frameProps}>
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">CPU / Memory / Disk trend</p>
            <p className="text-xs text-slate-400">5秒ごとに最新値を追記します</p>
          </div>
          <FaChartLine className="text-slate-400" />
        </div>
        <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <svg viewBox="0 0 320 96" className="h-full w-full">
            <path d={chartPathCpu} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
            <path d={chartPathMemory} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
            <path d={chartPathDisk} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />CPU</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Memory</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Disk</span>
        </div>
        {frameProps.mode === "detail" && latest ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">CPU {latest.cpu.toFixed(1)}%</div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">Memory {latest.memory.toFixed(1)}%</div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Disk {latest.disk.toFixed(1)}%</div>
          </div>
        ) : null}
      </div>
    </WidgetFrame>
  );
}

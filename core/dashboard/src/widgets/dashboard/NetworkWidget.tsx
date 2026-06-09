import { WidgetFrame } from "./WidgetFrame";
import { widgetIcon } from "../../dashboard/widgetDefinitions";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { DashboardMetrics } from "../../types";

export function NetworkWidget(props: { frameProps: DashboardWidgetFrameProps; metrics: DashboardMetrics | null }) {
  const { frameProps, metrics } = props;
  const interfaces = metrics?.network.interfaces ?? [];
  const shownInterfaces = interfaces.slice(0, frameProps.mode === "compact" ? 0 : frameProps.mode === "detail" ? 4 : 2);

  return (
    <WidgetFrame {...frameProps}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-2xl bg-slate-100 p-3 text-slate-600">{widgetIcon("network")}</span>
          <div className="text-right">
            <p className={`${frameProps.mode === "detail" ? "text-4xl" : "text-3xl"} font-bold text-slate-900`}>
              {metrics?.network.interfaceCount ?? 0}
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">interfaces</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex justify-between gap-3">
            <span>primary</span>
            <span className="font-mono text-slate-900">{metrics?.network.primaryAddress ?? "--"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>dns</span>
            <span className="font-semibold text-slate-900">{metrics?.network.dnsEnabled ? "enabled" : "disabled"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>root domain</span>
            <span className="font-mono text-slate-900">{metrics?.network.rootDomain ?? "--"}</span>
          </div>
        </div>

        {shownInterfaces.length > 0 ? (
          <div className="mt-4 space-y-2">
            {shownInterfaces.map((item) => (
              <div key={`${item.name}-${item.address}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{item.name}</span>
                <span className="ml-2 font-mono">{item.address}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </WidgetFrame>
  );
}

import { WidgetFrame } from "./WidgetFrame";
import type { DashboardWidgetFrameProps, LogWidgetState } from "../../dashboard/types";
import type { ApplicationListItem } from "../../types";
import { toLocale } from "../../ui";

type LogWidgetProps = {
  frameProps: DashboardWidgetFrameProps;
  logWidget: LogWidgetState;
  applications: ApplicationListItem[];
  logSourceOptions: ApplicationListItem[];
  onLogApplicationChange: (applicationId: string | null) => void;
  onLogServiceChange: (service: string) => void;
};

export function LogWidget(props: LogWidgetProps) {
  const { frameProps, logWidget, applications, logSourceOptions, onLogApplicationChange, onLogServiceChange } = props;
  const activeApp = applications.find((application) => application.application_id === logWidget.applicationId) ?? null;
  const visibleLines = logWidget.lines.slice(frameProps.mode === "compact" ? -18 : frameProps.mode === "detail" ? -80 : -40);

  return (
    <WidgetFrame {...frameProps}>
      <div className="flex h-full flex-col">
        <div className={`mb-3 flex flex-wrap items-center gap-2 ${frameProps.mode === "compact" ? "" : "justify-between"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={logWidget.applicationId ?? ""}
              onChange={(event) => onLogApplicationChange(event.target.value || null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              {logSourceOptions.map((application) => (
                <option key={application.application_id} value={application.application_id}>
                  {application.name}
                </option>
              ))}
            </select>
            <select
              value={logWidget.selectedService}
              onChange={(event) => onLogServiceChange(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="">既定サービス</option>
              {logWidget.services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
          {frameProps.mode !== "compact" ? <span className="text-xs text-slate-400">{activeApp ? activeApp.hostname : "ログ対象なし"}</span> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-200" data-widget-scrollable="true">
          {logWidget.loading ? <p className="text-slate-400">ログ取得中...</p> : null}
          {!logWidget.loading && visibleLines.length === 0 ? <p className="text-slate-400">ログはまだありません。</p> : null}
          <ul className="space-y-1">
            {visibleLines.map((line, index) => (
              <li key={`${index}-${line.slice(0, 20)}`} className="whitespace-pre-wrap break-words">
                {line}
              </li>
            ))}
          </ul>
        </div>
        {frameProps.mode !== "compact" ? (
          <div className="mt-2 text-[11px] text-slate-400">{logWidget.fetchedAt ? `${toLocale(logWidget.fetchedAt)} 取得` : "未取得"}</div>
        ) : null}
      </div>
    </WidgetFrame>
  );
}

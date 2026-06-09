import { WidgetFrame } from "./WidgetFrame";
import { healthMeta } from "../../ui";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { ApplicationListItem } from "../../types";

type ApplicationsWidgetProps = {
  frameProps: DashboardWidgetFrameProps;
  applications: ApplicationListItem[];
  onOpenApplications: () => void;
  onOpenDetail: (applicationId: string) => void;
};

export function ApplicationsWidget(props: ApplicationsWidgetProps) {
  const { frameProps, applications, onOpenApplications, onOpenDetail } = props;
  const shownApplications = applications.slice(0, frameProps.mode === "compact" ? 4 : frameProps.mode === "detail" ? 10 : 6);

  return (
    <WidgetFrame {...frameProps}>
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">アプリケーション</p>
          <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenApplications}>
            管理画面へ
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${frameProps.mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
          {shownApplications.map((application) => {
            const health = healthMeta(application.health);
            return (
              <button
                key={application.application_id}
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-white"
                onClick={() => onOpenDetail(application.application_id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{application.name}</p>
                  {frameProps.mode !== "compact" ? <p className="mt-1 truncate text-xs text-slate-400">{application.hostname}</p> : null}
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{health.label}</span>
              </button>
            );
          })}
          {shownApplications.length === 0 ? <p className="text-sm text-slate-400">アプリはありません。</p> : null}
        </div>
      </div>
    </WidgetFrame>
  );
}

import { AlertWidget } from "./AlertWidget";
import { ApplicationsWidget } from "./ApplicationsWidget";
import { ChartWidget } from "./ChartWidget";
import { CpuWidget } from "./CpuWidget";
import { DiskWidget } from "./DiskWidget";
import { EventsWidget } from "./EventsWidget";
import { JobsWidget } from "./JobsWidget";
import { LogWidget } from "./LogWidget";
import { MemoryWidget } from "./MemoryWidget";
import { NetworkWidget } from "./NetworkWidget";
import { StatusWidget } from "./StatusWidget";
import { WidgetFrame } from "./WidgetFrame";
import { resolveWidgetMode } from "../../dashboard/widgetDefinitions";
import type { DashboardWidgetRendererSharedProps, GridItemLayout } from "../../dashboard/types";
import type { DashboardBreakpoint, DashboardWidget } from "../../types";

type DashboardWidgetRendererProps = DashboardWidgetRendererSharedProps & {
  widget: DashboardWidget;
  layout: GridItemLayout | null;
  pageIndex: number;
  totalPages: number;
  breakpoint: DashboardBreakpoint;
  editMode: boolean;
  onDelete: (widgetId: string) => void;
};

export function DashboardWidgetRenderer(props: DashboardWidgetRendererProps) {
  const {
    widget,
    layout,
    pageIndex,
    totalPages,
    breakpoint,
    editMode,
    onDelete,
    system,
    applications,
    jobs,
    events,
    metrics,
    metricsHistory,
    dashboardPageCount,
    dashboardWidgetCount,
    logWidget,
    logSourceOptions,
    onLogApplicationChange,
    onLogServiceChange,
    onOpenApplications,
    onOpenEvents,
    onOpenDetail
  } = props;

  const frameProps = {
    widget,
    mode: resolveWidgetMode(widget.type, layout),
    editMode,
    layout,
    pageIndex,
    totalPages,
    breakpoint,
    onDelete
  } as const;

  switch (widget.type) {
    case "status":
      return (
        <StatusWidget
          frameProps={frameProps}
          system={system}
          applications={applications}
          jobs={jobs}
          metrics={metrics}
          dashboardPageCount={dashboardPageCount}
          dashboardWidgetCount={dashboardWidgetCount}
        />
      );
    case "cpu":
      return <CpuWidget frameProps={frameProps} metrics={metrics} />;
    case "memory":
      return <MemoryWidget frameProps={frameProps} metrics={metrics} />;
    case "disk":
      return <DiskWidget frameProps={frameProps} metrics={metrics} />;
    case "network":
      return <NetworkWidget frameProps={frameProps} metrics={metrics} />;
    case "alert":
      return <AlertWidget frameProps={frameProps} metrics={metrics} onOpenEvents={onOpenEvents} />;
    case "chart":
      return <ChartWidget frameProps={frameProps} metricsHistory={metricsHistory} />;
    case "applications":
      return (
        <ApplicationsWidget
          frameProps={frameProps}
          applications={applications}
          onOpenApplications={onOpenApplications}
          onOpenDetail={onOpenDetail}
        />
      );
    case "jobs":
      return <JobsWidget frameProps={frameProps} jobs={jobs} />;
    case "events":
      return <EventsWidget frameProps={frameProps} events={events} />;
    case "log":
      return (
        <LogWidget
          frameProps={frameProps}
          logWidget={logWidget}
          applications={applications}
          logSourceOptions={logSourceOptions}
          onLogApplicationChange={onLogApplicationChange}
          onLogServiceChange={onLogServiceChange}
        />
      );
    default:
      return (
        <WidgetFrame {...frameProps}>
          <div className="flex h-full items-center justify-center text-sm text-slate-400">未対応のウィジェットです。</div>
        </WidgetFrame>
      );
  }
}

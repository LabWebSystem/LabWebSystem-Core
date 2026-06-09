import type {
  ApplicationJob,
  ApplicationListItem,
  DashboardBreakpoint,
  DashboardLayoutItem,
  DashboardMetrics,
  DashboardWidget,
  SystemEvent,
  SystemStatus
} from "../types";

export type GridItemLayout = Omit<DashboardLayoutItem, "pageId">;

export type GridLayouts = Record<DashboardBreakpoint, GridItemLayout[]>;

export type WidgetVisualMode = "compact" | "standard" | "detail";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type WidgetSizing = {
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
};

export type WidgetDefinition = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  sizes: Record<DashboardBreakpoint, WidgetSizing>;
};

export type MetricsHistory = {
  label: string;
  cpu: number;
  memory: number;
  disk: number;
};

export type LogWidgetState = {
  applicationId: string | null;
  services: string[];
  selectedService: string;
  lines: string[];
  fetchedAt: string;
  loading: boolean;
};

export type DashboardWidgetFrameProps = {
  widget: DashboardWidget;
  mode: WidgetVisualMode;
  editMode: boolean;
  layout: GridItemLayout | null;
  pageIndex: number;
  totalPages: number;
  breakpoint: DashboardBreakpoint;
  onDelete: (widgetId: string) => void;
};

export type DashboardWidgetRendererSharedProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  metrics: DashboardMetrics | null;
  metricsHistory: MetricsHistory[];
  dashboardPageCount: number;
  dashboardWidgetCount: number;
  logWidget: LogWidgetState;
  logSourceOptions: ApplicationListItem[];
  onLogApplicationChange: (applicationId: string | null) => void;
  onLogServiceChange: (service: string) => void;
  onOpenApplications: () => void;
  onOpenEvents: () => void;
  onOpenDetail: (applicationId: string) => void;
};

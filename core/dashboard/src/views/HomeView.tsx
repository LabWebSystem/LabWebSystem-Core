import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import WidthProvider, { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  FaArrowDown,
  FaArrowUp,
  FaChartLine,
  FaCircleExclamation,
  FaDatabase,
  FaEthernet,
  FaHardDrive,
  FaMemory,
  FaMicrochip,
  FaPlus,
  FaTrashCan
} from "react-icons/fa6";
import {
  fetchApplicationLogServices,
  fetchApplicationLogs,
  fetchDashboardLayout,
  fetchDashboardMetrics,
  saveDashboardLayout
} from "../api";
import type {
  ApplicationJob,
  ApplicationListItem,
  DashboardBreakpoint,
  DashboardLayoutDocument,
  DashboardLayoutItem,
  DashboardMetrics,
  DashboardResponsiveLayouts,
  DashboardWidget,
  DashboardWidgetType,
  SystemEvent,
  SystemStatus
} from "../types";
import { formatRelative, healthMeta, jobStatusLabel, jobTypeLabel, toLocale } from "../ui";

const ResponsiveGridLayout = WidthProvider(Responsive as any) as any;

const DASHBOARD_ID = "operations-monitoring";
const USER_ID = "default";
const BREAKPOINTS = { lg: 1200, md: 960, sm: 720, xs: 0 } as const;
const COLS = { lg: 12, md: 10, sm: 6, xs: 4 } as const;
const PAGE_LABELS = ["状態概要", "リソース監視", "アラートとアプリ", "イベントとジョブ", "ログモニター"] as const;
const ROW_HEIGHT = 48;
const GRID_MARGIN: [number, number] = [12, 12];
const CONTAINER_PADDING: [number, number] = [16, 16];
const HISTORY_LIMIT = 24;
type GridItemLayout = Omit<DashboardLayoutItem, "page">;
type GridLayouts = Record<DashboardBreakpoint, GridItemLayout[]>;

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenEvents: () => void;
  onOpenDetail: (applicationId: string) => void;
};

type MetricsHistory = {
  label: string;
  cpu: number;
  memory: number;
  disk: number;
};

type LogWidgetState = {
  applicationId: string | null;
  services: string[];
  selectedService: string;
  lines: string[];
  fetchedAt: string;
  loading: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";
const EMPTY_GRID_LAYOUTS: GridLayouts = { lg: [], md: [], sm: [], xs: [] };

function toRglLayouts(document: DashboardLayoutDocument, page: number): GridLayouts {
  const layoutKeys = Object.keys(document.layouts) as DashboardBreakpoint[];
  return Object.fromEntries(
    layoutKeys.map((breakpoint) => [
      breakpoint,
      document.layouts[breakpoint]
        .filter((item) => item.page === page)
        .map((item) => ({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: item.minW,
          minH: item.minH,
          maxW: item.maxW,
          maxH: item.maxH,
          static: item.static,
          isDraggable: item.isDraggable,
          isResizable: item.isResizable
        }))
    ])
  ) as GridLayouts;
}

function mergeLayoutsForPage(
  currentLayouts: DashboardResponsiveLayouts,
  page: number,
  nextLayouts: GridLayouts,
  widgets: DashboardWidget[]
): DashboardResponsiveLayouts {
  const breakpoints = Object.keys(currentLayouts) as DashboardBreakpoint[];

  return Object.fromEntries(
    breakpoints.map((breakpoint) => {
      const pageWidgetIds = new Set(widgets.filter((widget) => widget.page === page).map((widget) => widget.id));
      const preserved = currentLayouts[breakpoint].filter((item) => item.page !== page);
      const replacement = nextLayouts[breakpoint]
        .filter((item: GridItemLayout) => pageWidgetIds.has(item.i))
        .map((item: GridItemLayout) => ({
          i: item.i,
          page,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: item.minW,
          minH: item.minH,
          maxW: item.maxW,
          maxH: item.maxH,
          static: item.static,
          isDraggable: item.isDraggable,
          isResizable: item.isResizable
        }));

      return [breakpoint, [...preserved, ...replacement]];
    })
  ) as DashboardResponsiveLayouts;
}

function widgetLabel(type: DashboardWidgetType): string {
  switch (type) {
    case "status":
      return "ステータスカード";
    case "cpu":
      return "CPU使用率";
    case "memory":
      return "メモリ使用率";
    case "disk":
      return "ディスク使用率";
    case "network":
      return "ネットワーク状況";
    case "alert":
      return "アラート一覧";
    case "log":
      return "ログ一覧";
    case "chart":
      return "グラフ表示";
    case "applications":
      return "アプリ一覧";
    case "jobs":
      return "ジョブ一覧";
    case "events":
      return "イベント一覧";
    default:
      return "ウィジェット";
  }
}

function makeWidgetId(type: DashboardWidgetType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function widgetPreset(type: DashboardWidgetType, page: number): DashboardWidget {
  const isStatus = type === "status";
  return {
    id: makeWidgetId(type),
    type,
    title: widgetLabel(type),
    page,
    static: isStatus,
    isDraggable: !isStatus,
    isResizable: !isStatus
  };
}

function layoutPreset(widget: DashboardWidget, breakpoint: DashboardBreakpoint, y: number): DashboardLayoutItem {
  const cols = COLS[breakpoint];
  const base = (() => {
    switch (widget.type) {
      case "status":
        return { w: cols, h: 3, minW: Math.min(cols, 4), minH: 3, maxW: cols, maxH: 3 };
      case "cpu":
      case "memory":
      case "disk":
      case "network":
        return { w: Math.min(cols, breakpoint === "lg" ? 3 : breakpoint === "md" ? 5 : cols), h: 4, minW: Math.min(cols, 2), minH: 3 };
      case "chart":
        return { w: Math.min(cols, breakpoint === "lg" ? 6 : cols), h: 5, minW: Math.min(cols, 3), minH: 4 };
      case "alert":
      case "applications":
      case "events":
      case "jobs":
        return { w: Math.min(cols, breakpoint === "xs" ? cols : Math.ceil(cols / 2)), h: 5, minW: Math.min(cols, 2), minH: 4 };
      case "log":
        return { w: cols, h: 6, minW: Math.min(cols, 3), minH: 4 };
      default:
        return { w: Math.min(cols, 4), h: 4, minW: Math.min(cols, 2), minH: 3 };
    }
  })();

  return {
    i: widget.id,
    page: widget.page,
    x: 0,
    y,
    w: base.w,
    h: base.h,
    minW: base.minW,
    minH: base.minH,
    maxW: base.maxW,
    maxH: base.maxH,
    static: widget.static,
    isDraggable: widget.isDraggable,
    isResizable: widget.isResizable
  };
}

function buildDefaultDashboardLayout(): DashboardLayoutDocument {
  const widgets: DashboardWidget[] = [
    { id: "status-primary", type: "status", title: "システムステータス", page: 0, static: true, isDraggable: false, isResizable: false },
    { id: "cpu-primary", type: "cpu", title: "CPU使用率", page: 0 },
    { id: "memory-primary", type: "memory", title: "メモリ使用率", page: 0 },
    { id: "disk-primary", type: "disk", title: "ディスク使用率", page: 1 },
    { id: "network-primary", type: "network", title: "ネットワーク状況", page: 1 },
    { id: "chart-primary", type: "chart", title: "推移グラフ", page: 1 },
    { id: "alerts-primary", type: "alert", title: "アラート一覧", page: 2 },
    { id: "apps-primary", type: "applications", title: "アプリ一覧", page: 2 },
    { id: "events-primary", type: "events", title: "イベント一覧", page: 3 },
    { id: "jobs-primary", type: "jobs", title: "ジョブ一覧", page: 3 },
    { id: "logs-primary", type: "log", title: "ログ一覧", page: 4 }
  ];

  const layouts: DashboardResponsiveLayouts = {
    lg: [
      { i: "status-primary", page: 0, x: 0, y: 0, w: 12, h: 3, minW: 12, minH: 3, maxW: 12, maxH: 3, static: true, isDraggable: false, isResizable: false },
      { i: "cpu-primary", page: 0, x: 0, y: 3, w: 6, h: 4, minW: 3, minH: 3 },
      { i: "memory-primary", page: 0, x: 6, y: 3, w: 6, h: 4, minW: 3, minH: 3 },
      { i: "disk-primary", page: 1, x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
      { i: "network-primary", page: 1, x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
      { i: "chart-primary", page: 1, x: 6, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "alerts-primary", page: 2, x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "apps-primary", page: 2, x: 6, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "events-primary", page: 3, x: 0, y: 0, w: 7, h: 6, minW: 4, minH: 4 },
      { i: "jobs-primary", page: 3, x: 7, y: 0, w: 5, h: 6, minW: 4, minH: 4 },
      { i: "logs-primary", page: 4, x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 4 }
    ],
    md: [
      { i: "status-primary", page: 0, x: 0, y: 0, w: 10, h: 3, minW: 10, minH: 3, maxW: 10, maxH: 3, static: true, isDraggable: false, isResizable: false },
      { i: "cpu-primary", page: 0, x: 0, y: 3, w: 5, h: 4, minW: 3, minH: 3 },
      { i: "memory-primary", page: 0, x: 5, y: 3, w: 5, h: 4, minW: 3, minH: 3 },
      { i: "disk-primary", page: 1, x: 0, y: 0, w: 5, h: 4, minW: 3, minH: 3 },
      { i: "network-primary", page: 1, x: 5, y: 0, w: 5, h: 4, minW: 3, minH: 3 },
      { i: "chart-primary", page: 1, x: 0, y: 4, w: 10, h: 5, minW: 5, minH: 4 },
      { i: "alerts-primary", page: 2, x: 0, y: 0, w: 10, h: 5, minW: 5, minH: 4 },
      { i: "apps-primary", page: 2, x: 0, y: 5, w: 10, h: 5, minW: 5, minH: 4 },
      { i: "events-primary", page: 3, x: 0, y: 0, w: 10, h: 5, minW: 5, minH: 4 },
      { i: "jobs-primary", page: 3, x: 0, y: 5, w: 10, h: 4, minW: 4, minH: 4 },
      { i: "logs-primary", page: 4, x: 0, y: 0, w: 10, h: 6, minW: 5, minH: 4 }
    ],
    sm: [
      { i: "status-primary", page: 0, x: 0, y: 0, w: 6, h: 3, minW: 6, minH: 3, maxW: 6, maxH: 3, static: true, isDraggable: false, isResizable: false },
      { i: "cpu-primary", page: 0, x: 0, y: 3, w: 6, h: 4, minW: 3, minH: 3 },
      { i: "memory-primary", page: 0, x: 0, y: 7, w: 6, h: 4, minW: 3, minH: 3 },
      { i: "disk-primary", page: 1, x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
      { i: "network-primary", page: 1, x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
      { i: "chart-primary", page: 1, x: 0, y: 8, w: 6, h: 5, minW: 4, minH: 4 },
      { i: "alerts-primary", page: 2, x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
      { i: "apps-primary", page: 2, x: 0, y: 5, w: 6, h: 5, minW: 4, minH: 4 },
      { i: "events-primary", page: 3, x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
      { i: "jobs-primary", page: 3, x: 0, y: 5, w: 6, h: 4, minW: 4, minH: 4 },
      { i: "logs-primary", page: 4, x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 }
    ],
    xs: [
      { i: "status-primary", page: 0, x: 0, y: 0, w: 4, h: 3, minW: 4, minH: 3, maxW: 4, maxH: 3, static: true, isDraggable: false, isResizable: false },
      { i: "cpu-primary", page: 0, x: 0, y: 3, w: 4, h: 4, minW: 2, minH: 3 },
      { i: "memory-primary", page: 0, x: 0, y: 7, w: 4, h: 4, minW: 2, minH: 3 },
      { i: "disk-primary", page: 1, x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
      { i: "network-primary", page: 1, x: 0, y: 4, w: 4, h: 4, minW: 2, minH: 3 },
      { i: "chart-primary", page: 1, x: 0, y: 8, w: 4, h: 5, minW: 3, minH: 4 },
      { i: "alerts-primary", page: 2, x: 0, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
      { i: "apps-primary", page: 2, x: 0, y: 5, w: 4, h: 5, minW: 3, minH: 4 },
      { i: "events-primary", page: 3, x: 0, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
      { i: "jobs-primary", page: 3, x: 0, y: 5, w: 4, h: 4, minW: 3, minH: 4 },
      { i: "logs-primary", page: 4, x: 0, y: 0, w: 4, h: 6, minW: 3, minH: 4 }
    ]
  };

  return {
    widgets,
    layouts,
    currentPage: 0,
    pageCount: PAGE_LABELS.length
  };
}

function normalizeDashboardLayout(document: DashboardLayoutDocument): DashboardLayoutDocument {
  const pageCount = PAGE_LABELS.length;
  return {
    ...document,
    currentPage: Math.max(0, Math.min(pageCount - 1, document.currentPage ?? 0)),
    pageCount,
    widgets: document.widgets.map((widget) => ({
      ...widget,
      page: Math.max(0, Math.min(pageCount - 1, widget.page ?? 0))
    })),
    layouts: Object.fromEntries(
      (Object.keys(document.layouts) as DashboardBreakpoint[]).map((breakpoint) => [
        breakpoint,
        document.layouts[breakpoint].map((item) => ({
          ...item,
          page: Math.max(0, Math.min(pageCount - 1, item.page ?? 0))
        }))
      ])
    ) as DashboardResponsiveLayouts
  };
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function gaugeTone(value: number): string {
  if (value >= 85) {
    return "bg-rose-500";
  }
  if (value >= 65) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
}

function findScrollableAncestor(target: EventTarget | null, boundary: HTMLElement | null): HTMLElement | null {
  if (!(target instanceof HTMLElement) || !boundary) {
    return null;
  }

  let element: HTMLElement | null = target;
  while (element && element !== boundary) {
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    const isScrollable =
      element.dataset.widgetScrollable === "true" ||
      ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight + 2);

    if (isScrollable) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function canScrollInside(element: HTMLElement, deltaY: number): boolean {
  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 2;
  }
  if (deltaY < 0) {
    return element.scrollTop > 2;
  }
  return false;
}

function WidgetFrame(props: {
  widget: DashboardWidget;
  editMode: boolean;
  onDelete: (widgetId: string) => void;
  onMovePage: (widgetId: string, delta: -1 | 1) => void;
  children: ReactNode;
}) {
  const { widget, editMode, onDelete, onMovePage, children } = props;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(15,23,42,0.45)]">
      <div className="widget-drag-handle flex cursor-grab items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 active:cursor-grabbing">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{widget.title}</p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">page {widget.page + 1}</p>
        </div>

        <div className="flex items-center gap-1">
          {editMode ? (
            <>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                onClick={() => onMovePage(widget.id, -1)}
                disabled={widget.page <= 0}
                title="前のページへ移動"
              >
                <FaArrowUp />
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-xs text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                onClick={() => onMovePage(widget.id, 1)}
                disabled={widget.page >= PAGE_LABELS.length - 1}
                title="次のページへ移動"
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

function MetricWidget(props: {
  icon: React.ReactNode;
  value: number;
  label: string;
  meta: string;
}) {
  const { icon, value, label, meta } = props;
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="rounded-2xl bg-slate-100 p-3 text-slate-600">{icon}</span>
        <span className="text-3xl font-bold text-slate-900">{value.toFixed(1)}%</span>
      </div>
      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="mt-1 text-sm text-slate-500">{meta}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${gaugeTone(value)}`} style={{ width: `${Math.max(6, value)}%` }} />
      </div>
    </div>
  );
}

export function HomeView(props: HomeViewProps) {
  const { system, applications, jobs, events, onOpenApplications, onOpenEvents, onOpenDetail } = props;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistory[]>([]);
  const [dashboard, setDashboard] = useState<DashboardLayoutDocument | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [editMode, setEditMode] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [breakpoint, setBreakpoint] = useState<DashboardBreakpoint>("lg");
  const [isLayoutInteracting, setIsLayoutInteracting] = useState(false);
  const [isPageAnimating, setIsPageAnimating] = useState(false);
  const [logWidget, setLogWidget] = useState<LogWidgetState>({
    applicationId: null,
    services: [],
    selectedService: "",
    lines: [],
    fetchedAt: "",
    loading: false
  });
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const touchScrollLockRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  const currentPage = dashboard?.currentPage ?? 0;
  const currentLayouts = useMemo(() => (dashboard ? toRglLayouts(dashboard, currentPage) : EMPTY_GRID_LAYOUTS), [dashboard, currentPage]);
  const widgetsOnCurrentPage = useMemo(
    () => (dashboard ? dashboard.widgets.filter((widget) => widget.page === currentPage) : []),
    [dashboard, currentPage]
  );

  const logSourceOptions = useMemo(
    () => applications.filter((application) => application.status === "Running" || application.health?.severity !== "critical"),
    [applications]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      try {
        const [layoutResponse, metricsResponse] = await Promise.all([
          fetchDashboardLayout(DASHBOARD_ID, USER_ID),
          fetchDashboardMetrics()
        ]);

        if (cancelled) {
          return;
        }

        const nextLayout = normalizeDashboardLayout(layoutResponse.layout ?? buildDefaultDashboardLayout());
        setDashboard(nextLayout);
        setMetrics(metricsResponse);
        setMetricsHistory([
          {
            label: new Date(metricsResponse.generatedAt).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit"
            }),
            cpu: metricsResponse.cpu.usagePercent,
            memory: metricsResponse.memory.usagePercent,
            disk: metricsResponse.disk.usagePercent
          }
        ]);
        loadedRef.current = true;
      } catch {
        if (cancelled) {
          return;
        }
        setDashboard(buildDefaultDashboardLayout());
        loadedRef.current = true;
      }
    }

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchDashboardMetrics()
        .then((nextMetrics) => {
          setMetrics(nextMetrics);
          setMetricsHistory((previous) => {
            const next = [
              ...previous,
              {
                label: new Date(nextMetrics.generatedAt).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit"
                }),
                cpu: nextMetrics.cpu.usagePercent,
                memory: nextMetrics.memory.usagePercent,
                disk: nextMetrics.disk.usagePercent
              }
            ];
            return next.slice(-HISTORY_LIMIT);
          });
        })
        .catch(() => {
          // UI polling failure is non-fatal.
        });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fallbackAppId = logSourceOptions[0]?.application_id ?? null;
    if (!logWidget.applicationId && fallbackAppId) {
      setLogWidget((previous) => ({ ...previous, applicationId: fallbackAppId }));
    }
  }, [logSourceOptions, logWidget.applicationId]);

  useEffect(() => {
    if (!logWidget.applicationId) {
      return;
    }

    let cancelled = false;

    async function refreshLogs() {
      const applicationId = logWidget.applicationId;
      if (!applicationId) {
        return;
      }

      setLogWidget((previous) => ({ ...previous, loading: true }));
      try {
        const services = await fetchApplicationLogServices(applicationId);
        const preferredService = services.includes(logWidget.selectedService)
          ? logWidget.selectedService
          : (services[0] ?? "");
        const response = await fetchApplicationLogs(applicationId, {
          service: preferredService || undefined,
          tail: 120
        });

        if (cancelled) {
          return;
        }

        setLogWidget((previous) => ({
          ...previous,
          services,
          selectedService: preferredService,
          lines: response.lines,
          fetchedAt: response.fetchedAt,
          loading: false
        }));
      } catch {
        if (cancelled) {
          return;
        }
        setLogWidget((previous) => ({ ...previous, loading: false }));
      }
    }

    void refreshLogs();
    const intervalId = window.setInterval(() => {
      void refreshLogs();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [logWidget.applicationId, logWidget.selectedService]);

  useEffect(() => {
    if (!dashboard || !loadedRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("saving");
      void saveDashboardLayout(dashboard, DASHBOARD_ID, USER_ID)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [dashboard]);

  function changePage(nextPage: number) {
    if (!dashboard) {
      return;
    }
    if (nextPage < 0 || nextPage >= dashboard.pageCount || nextPage === dashboard.currentPage || isLayoutInteracting || isPageAnimating) {
      return;
    }

    setIsPageAnimating(true);
    setDashboard((previous) => (previous ? { ...previous, currentPage: nextPage } : previous));
    window.setTimeout(() => setIsPageAnimating(false), 420);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!dashboard || isLayoutInteracting || isPageAnimating || Math.abs(event.deltaY) < 24) {
      return;
    }

    const scrollable = findScrollableAncestor(event.target, rootRef.current);
    if (scrollable && canScrollInside(scrollable, event.deltaY)) {
      return;
    }

    event.preventDefault();
    changePage(currentPage + (event.deltaY > 0 ? 1 : -1));
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    setTouchStartY(event.touches[0]?.clientY ?? null);
    touchScrollLockRef.current = Boolean(findScrollableAncestor(event.target, rootRef.current));
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartY === null || !dashboard || isLayoutInteracting || isPageAnimating || touchScrollLockRef.current) {
      touchScrollLockRef.current = false;
      return;
    }

    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const diff = touchStartY - endY;
    if (Math.abs(diff) < 48) {
      return;
    }

    changePage(currentPage + (diff > 0 ? 1 : -1));
    setTouchStartY(null);
    touchScrollLockRef.current = false;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      changePage(currentPage + 1);
    }
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      changePage(currentPage - 1);
    }
  }

  function updateLayouts(nextLayouts: GridLayouts) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        layouts: mergeLayoutsForPage(previous.layouts, previous.currentPage, nextLayouts, previous.widgets)
      };
    });
  }

  function addWidget(type: DashboardWidgetType) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const widget = widgetPreset(type, previous.currentPage);
      const nextLayouts = { ...previous.layouts } as DashboardResponsiveLayouts;
      for (const bp of Object.keys(nextLayouts) as DashboardBreakpoint[]) {
        const pageItems = nextLayouts[bp].filter((item) => item.page === previous.currentPage);
        const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        nextLayouts[bp] = [...nextLayouts[bp], layoutPreset(widget, bp, bottomY)];
      }

      return {
        ...previous,
        widgets: [...previous.widgets, widget],
        layouts: nextLayouts
      };
    });
    setWidgetPickerOpen(false);
  }

  function deleteWidget(widgetId: string) {
    if (!window.confirm("このウィジェットを削除しますか？")) {
      return;
    }

    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        widgets: previous.widgets.filter((widget) => widget.id !== widgetId),
        layouts: Object.fromEntries(
          (Object.keys(previous.layouts) as DashboardBreakpoint[]).map((bp) => [
            bp,
            previous.layouts[bp].filter((item) => item.i !== widgetId)
          ])
        ) as DashboardResponsiveLayouts
      };
    });
  }

  function moveWidgetPage(widgetId: string, delta: -1 | 1) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const widget = previous.widgets.find((candidate) => candidate.id === widgetId);
      if (!widget) {
        return previous;
      }

      const nextPage = Math.max(0, Math.min(previous.pageCount - 1, widget.page + delta));
      if (nextPage === widget.page) {
        return previous;
      }

      const widgets = previous.widgets.map((candidate) =>
        candidate.id === widgetId ? { ...candidate, page: nextPage } : candidate
      );

      const layouts = Object.fromEntries(
        (Object.keys(previous.layouts) as DashboardBreakpoint[]).map((bp) => {
          const pageItems = previous.layouts[bp].filter((item) => item.page === nextPage);
          const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);
          return [
            bp,
            previous.layouts[bp].map((item) =>
              item.i === widgetId
                ? {
                    ...item,
                    page: nextPage,
                    x: 0,
                    y: bottomY
                  }
                : item
            )
          ];
        })
      ) as DashboardResponsiveLayouts;

      return {
        ...previous,
        widgets,
        layouts
      };
    });
  }

  const chartPathCpu = sparklinePath(metricsHistory.map((item) => item.cpu), 320, 96);
  const chartPathMemory = sparklinePath(metricsHistory.map((item) => item.memory), 320, 96);
  const chartPathDisk = sparklinePath(metricsHistory.map((item) => item.disk), 320, 96);

  function renderWidget(widget: DashboardWidget) {
    switch (widget.type) {
      case "status":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="grid h-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Apps</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{system?.applicationSummary.total ?? applications.length}</p>
                <p className="mt-2 text-sm text-slate-500">登録アプリ / 稼働 {system?.applicationSummary.running ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Healthy</p>
                <p className="mt-3 text-3xl font-bold text-emerald-900">
                  {applications.filter((application) => application.health?.severity === "ok").length}
                </p>
                <p className="mt-2 text-sm text-emerald-700">安定稼働しているアプリ</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Queue</p>
                <p className="mt-3 text-3xl font-bold text-amber-900">{jobs.filter((job) => job.status !== "succeeded").length}</p>
                <p className="mt-2 text-sm text-amber-700">待機・実行・要確認ジョブ</p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Layout</p>
                <p className="mt-3 text-3xl font-bold text-violet-900">{dashboard?.widgets.length ?? 0}</p>
                <p className="mt-2 text-sm text-violet-700">配置中ウィジェット / page {currentPage + 1}</p>
              </div>
            </div>
          </WidgetFrame>
        );
      case "cpu":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <MetricWidget
              icon={<FaMicrochip className="text-xl" />}
              value={metrics?.cpu.usagePercent ?? 0}
              label="CPU使用率"
              meta={`load avg ${metrics?.cpu.loadAverage1m ?? 0} / ${metrics?.cpu.coreCount ?? 0} cores`}
            />
          </WidgetFrame>
        );
      case "memory":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <MetricWidget
              icon={<FaMemory className="text-xl" />}
              value={metrics?.memory.usagePercent ?? 0}
              label="メモリ使用率"
              meta={`${formatBytes(metrics?.memory.usedBytes ?? 0)} / ${formatBytes(metrics?.memory.totalBytes ?? 0)}`}
            />
          </WidgetFrame>
        );
      case "disk":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <MetricWidget
              icon={<FaHardDrive className="text-xl" />}
              value={metrics?.disk.usagePercent ?? 0}
              label="ディスク使用率"
              meta={`${formatBytes(metrics?.disk.usedBytes ?? 0)} / ${formatBytes(metrics?.disk.totalBytes ?? 0)}`}
            />
          </WidgetFrame>
        );
      case "network":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                  <FaEthernet className="text-xl" />
                </span>
                <div className="text-right">
                  <p className="text-3xl font-bold text-slate-900">{metrics?.network.interfaceCount ?? 0}</p>
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
            </div>
          </WidgetFrame>
        );
      case "alert":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">warning / error</p>
                <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenEvents}>
                  すべて見る
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" data-widget-scrollable="true">
                {(metrics?.alerts ?? []).map((alert) => (
                  <div key={alert.event_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          alert.level === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {alert.level}
                      </span>
                      <span className="text-[11px] text-slate-400">{toLocale(alert.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-900">{alert.title}</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{alert.message}</p>
                  </div>
                ))}
                {(metrics?.alerts ?? []).length === 0 ? <p className="text-sm text-slate-400">現在アラートはありません。</p> : null}
              </div>
            </div>
          </WidgetFrame>
        );
      case "chart":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
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
            </div>
          </WidgetFrame>
        );
      case "applications":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">アプリケーション</p>
                <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenApplications}>
                  管理画面へ
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" data-widget-scrollable="true">
                {applications.slice(0, 8).map((application) => {
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
                        <p className="mt-1 truncate text-xs text-slate-400">{application.hostname}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{health.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </WidgetFrame>
        );
      case "jobs":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="space-y-3 overflow-y-auto pr-1" data-widget-scrollable="true">
              {jobs.slice(0, 8).map((job) => (
                <div key={job.job_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{jobTypeLabel(job.type)}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{jobStatusLabel(job.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{job.application_name ?? "system"} / {formatRelative(job.created_at)}</p>
                  {job.message ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{job.message}</p> : null}
                </div>
              ))}
              {jobs.length === 0 ? <p className="text-sm text-slate-400">ジョブはありません。</p> : null}
            </div>
          </WidgetFrame>
        );
      case "events":
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="space-y-3 overflow-y-auto pr-1" data-widget-scrollable="true">
              {events.slice(0, 8).map((event) => (
                <div key={event.event_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{event.title}</p>
                    <span className="text-[11px] text-slate-400">{toLocale(event.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{event.application_name ?? event.scope ?? "system"}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{event.message}</p>
                </div>
              ))}
            </div>
          </WidgetFrame>
        );
      case "log": {
        const activeApp = applications.find((application) => application.application_id === logWidget.applicationId) ?? null;
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="flex h-full flex-col">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select
                  value={logWidget.applicationId ?? ""}
                  onChange={(event) =>
                    setLogWidget((previous) => ({
                      ...previous,
                      applicationId: event.target.value || null,
                      selectedService: ""
                    }))
                  }
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
                  onChange={(event) => setLogWidget((previous) => ({ ...previous, selectedService: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
                >
                  <option value="">既定サービス</option>
                  {logWidget.services.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-400">{activeApp ? activeApp.hostname : "ログ対象なし"}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-200" data-widget-scrollable="true">
                {logWidget.loading ? <p className="text-slate-400">ログ取得中...</p> : null}
                {!logWidget.loading && logWidget.lines.length === 0 ? <p className="text-slate-400">ログはまだありません。</p> : null}
                <ul className="space-y-1">
                  {logWidget.lines.map((line, index) => (
                    <li key={`${index}-${line.slice(0, 20)}`} className="whitespace-pre-wrap break-words">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">{logWidget.fetchedAt ? `${toLocale(logWidget.fetchedAt)} 取得` : "未取得"}</div>
            </div>
          </WidgetFrame>
        );
      }
      default:
        return (
          <WidgetFrame widget={widget} editMode={editMode} onDelete={deleteWidget} onMovePage={moveWidgetPage}>
            <div className="flex h-full items-center justify-center text-sm text-slate-400">未対応のウィジェットです。</div>
          </WidgetFrame>
        );
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-4 backdrop-blur">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Monitoring Dashboard</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">監視ウィジェットを自由に並べ替えできるダッシュボード</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${saveState === "error" ? "bg-rose-100 text-rose-700" : saveState === "saving" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {saveState === "saving" ? "レイアウト保存中" : saveState === "error" ? "保存失敗" : "保存済み"}
          </span>
          <button
            type="button"
            onClick={() => setEditMode((previous) => !previous)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              editMode ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {editMode ? "編集完了" : "レイアウト編集"}
          </button>
          <button
            type="button"
            onClick={() => setWidgetPickerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <FaPlus />
            ウィジェット追加
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={rootRef}
          className="relative min-h-0 flex-1 overflow-hidden outline-none"
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <div
            className="flex h-full flex-col transition-transform duration-[400ms] ease-out"
            style={{ transform: `translateY(-${currentPage * 100}%)` }}
          >
            {PAGE_LABELS.map((label, pageIndex) => (
              <section key={label} className="h-full min-h-0 shrink-0 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">page {pageIndex + 1}</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{label}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>12px gap</span>
                    <span>drag / resize enabled</span>
                    <span>{COLS[breakpoint]} cols</span>
                  </div>
                </div>

                <div className="h-[calc(100%-4rem)] min-h-0 rounded-[1.8rem] border border-white/80 bg-white/65 shadow-[0_26px_80px_-60px_rgba(15,23,42,0.6)] backdrop-blur">
                  {dashboard ? (
                    <ResponsiveGridLayout
                      className="layout h-full"
                      breakpoints={BREAKPOINTS}
                      cols={COLS}
                      rowHeight={ROW_HEIGHT}
                      margin={GRID_MARGIN}
                      containerPadding={CONTAINER_PADDING}
                      layouts={pageIndex === currentPage ? currentLayouts : toRglLayouts(dashboard, pageIndex)}
                      isDraggable={editMode}
                      isResizable={editMode}
                      draggableHandle=".widget-drag-handle"
                      preventCollision={false}
                      allowOverlap={false}
                      compactType="vertical"
                      resizeHandles={["se"]}
                      onBreakpointChange={(nextBreakpoint: string) => setBreakpoint(nextBreakpoint as DashboardBreakpoint)}
                      onLayoutChange={(_: unknown, nextLayouts: unknown) => {
                        if (pageIndex !== currentPage) {
                          return;
                        }
                        updateLayouts(nextLayouts as GridLayouts);
                      }}
                      onDragStart={() => setIsLayoutInteracting(true)}
                      onDragStop={() => setIsLayoutInteracting(false)}
                      onResizeStart={() => setIsLayoutInteracting(true)}
                      onResizeStop={() => setIsLayoutInteracting(false)}
                    >
                      {(pageIndex === currentPage ? widgetsOnCurrentPage : dashboard.widgets.filter((widget) => widget.page === pageIndex)).map((widget) => (
                        <div key={widget.id} className="overflow-hidden">
                          {renderWidget(widget)}
                        </div>
                      ))}
                    </ResponsiveGridLayout>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="hidden w-20 shrink-0 flex-col items-center justify-center gap-3 pr-4 lg:flex">
          {PAGE_LABELS.map((label, pageIndex) => (
            <button
              key={label}
              type="button"
              onClick={() => changePage(pageIndex)}
              className={`group flex items-center gap-3 ${
                pageIndex === currentPage ? "text-slate-900" : "text-slate-400"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${pageIndex === currentPage ? "bg-violet-600" : "bg-slate-300 group-hover:bg-slate-400"}`} />
              <span className="text-xs font-semibold">{pageIndex + 1}</span>
            </button>
          ))}
        </aside>
      </div>

      {widgetPickerOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Add Widget</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">現在ページへ追加するウィジェットを選択</h3>
              </div>
              <button type="button" onClick={() => setWidgetPickerOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                閉じる
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(["cpu", "memory", "disk", "network", "alert", "log", "chart", "status", "applications", "jobs", "events"] as DashboardWidgetType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addWidget(type)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-white p-3 text-slate-600 shadow-sm">
                      {type === "cpu" ? <FaMicrochip /> : type === "memory" ? <FaMemory /> : type === "disk" ? <FaDatabase /> : type === "network" ? <FaEthernet /> : type === "alert" ? <FaCircleExclamation /> : <FaChartLine />}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{widgetLabel(type)}</p>
                      <p className="mt-1 text-xs text-slate-500">page {currentPage + 1} に追加</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

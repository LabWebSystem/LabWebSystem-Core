import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import type { IconType } from "react-icons";
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
const BREAKPOINT_KEYS = Object.keys(BREAKPOINTS) as DashboardBreakpoint[];
const COLS = { lg: 12, md: 10, sm: 6, xs: 4 } as const;
const ROW_HEIGHT = 48;
const GRID_MARGIN: [number, number] = [12, 12];
const CONTAINER_PADDING: [number, number] = [16, 16];
const HISTORY_LIMIT = 24;
const PAGE_ANIMATION_MS = 420;

type GridItemLayout = Omit<DashboardLayoutItem, "pageId">;
type GridLayouts = Record<DashboardBreakpoint, GridItemLayout[]>;
type WidgetVisualMode = "compact" | "standard" | "detail";
type WidgetPickerTarget = "current" | "new-page";
type SaveState = "idle" | "saving" | "saved" | "error";

type WidgetSizing = {
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
};

type WidgetDefinition = {
  label: string;
  description: string;
  icon: IconType;
  sizes: Record<DashboardBreakpoint, WidgetSizing>;
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

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenEvents: () => void;
  onOpenDetail: (applicationId: string) => void;
};

type LegacyDashboardWidget = {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  pageId?: unknown;
  page?: unknown;
  static?: unknown;
  isDraggable?: unknown;
  isResizable?: unknown;
  config?: unknown;
};

type LegacyDashboardLayoutItem = {
  i?: unknown;
  pageId?: unknown;
  page?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  minW?: unknown;
  minH?: unknown;
  maxW?: unknown;
  maxH?: unknown;
  static?: unknown;
  isDraggable?: unknown;
  isResizable?: unknown;
};

const EMPTY_GRID_LAYOUTS: GridLayouts = { lg: [], md: [], sm: [], xs: [] };

const WIDGET_ORDER: DashboardWidgetType[] = [
  "status",
  "cpu",
  "memory",
  "disk",
  "network",
  "chart",
  "alert",
  "applications",
  "jobs",
  "events",
  "log"
];

const WIDGET_DEFINITIONS: Record<DashboardWidgetType, WidgetDefinition> = {
  status: {
    label: "ステータスカード",
    description: "主要な稼働数値をまとめて俯瞰します。",
    icon: FaChartLine,
    sizes: {
      lg: { w: 12, h: 4, minW: 6, minH: 3 },
      md: { w: 10, h: 4, minW: 6, minH: 3 },
      sm: { w: 6, h: 4, minW: 4, minH: 3 },
      xs: { w: 4, h: 4, minW: 4, minH: 3 }
    }
  },
  cpu: {
    label: "CPU使用率",
    description: "CPU の使用率と負荷傾向を表示します。",
    icon: FaMicrochip,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  memory: {
    label: "メモリ使用率",
    description: "メモリ使用量と総量のバランスを追います。",
    icon: FaMemory,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  disk: {
    label: "ディスク使用率",
    description: "ストレージ消費と残容量を確認します。",
    icon: FaHardDrive,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  network: {
    label: "ネットワーク状況",
    description: "IP / DNS / インターフェース状況を確認します。",
    icon: FaEthernet,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  chart: {
    label: "グラフ表示",
    description: "CPU / Memory / Disk の推移を比較します。",
    icon: FaChartLine,
    sizes: {
      lg: { w: 6, h: 5, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  alert: {
    label: "アラート一覧",
    description: "警告や異常を優先して流し見できます。",
    icon: FaCircleExclamation,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  applications: {
    label: "アプリ一覧",
    description: "アプリの健全性と詳細画面導線を並べます。",
    icon: FaDatabase,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  jobs: {
    label: "ジョブ一覧",
    description: "直近ジョブの状態とメッセージを監視します。",
    icon: FaChartLine,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  events: {
    label: "イベント一覧",
    description: "イベントログを時系列で確認します。",
    icon: FaCircleExclamation,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  log: {
    label: "ログ一覧",
    description: "アプリログをサービス単位で追跡します。",
    icon: FaDatabase,
    sizes: {
      lg: { w: 12, h: 7, minW: 6, minH: 4 },
      md: { w: 10, h: 6, minW: 5, minH: 4 },
      sm: { w: 6, h: 6, minW: 4, minH: 4 },
      xs: { w: 4, h: 6, minW: 3, minH: 4 }
    }
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasWidgetType(value: unknown): value is DashboardWidgetType {
  return typeof value === "string" && value in WIDGET_DEFINITIONS;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.round(value));
}

function dashboardPageTitle(index: number): string {
  return `Page ${index + 1}`;
}

function makePageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeWidgetId(type: DashboardWidgetType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function widgetDefinition(type: DashboardWidgetType): WidgetDefinition {
  return WIDGET_DEFINITIONS[type];
}

function widgetLabel(type: DashboardWidgetType): string {
  return widgetDefinition(type).label;
}

function widgetIcon(type: DashboardWidgetType, className = "text-xl"): ReactNode {
  const Icon = widgetDefinition(type).icon;
  return <Icon className={className} />;
}

function widgetSizing(type: DashboardWidgetType, breakpoint: DashboardBreakpoint): WidgetSizing {
  return widgetDefinition(type).sizes[breakpoint];
}

function formatGridSize(w: number, h: number): string {
  return `${w}×${h}`;
}

function modeLabel(mode: WidgetVisualMode): string {
  switch (mode) {
    case "compact":
      return "縮小";
    case "detail":
      return "詳細";
    default:
      return "標準";
  }
}

function pageBadgeLabel(index: number): string {
  return `page ${index + 1}`;
}

function createPage(index: number) {
  return {
    id: makePageId(),
    title: dashboardPageTitle(index)
  };
}

function renumberPages(pages: Array<{ id: string; title: string }>) {
  return pages.map((page, index) => ({
    ...page,
    title: dashboardPageTitle(index)
  }));
}

function cloneResponsiveLayouts(layouts: DashboardResponsiveLayouts): DashboardResponsiveLayouts {
  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => [
      breakpoint,
      layouts[breakpoint].map((item) => ({ ...item }))
    ])
  ) as DashboardResponsiveLayouts;
}

function toRglLayouts(document: DashboardLayoutDocument, pageId: string): GridLayouts {
  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => [
      breakpoint,
      document.layouts[breakpoint]
        .filter((item) => item.pageId === pageId)
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
  pageId: string,
  nextLayouts: GridLayouts,
  widgets: DashboardWidget[]
): DashboardResponsiveLayouts {
  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => {
      const pageWidgetIds = new Set(widgets.filter((widget) => widget.pageId === pageId).map((widget) => widget.id));
      const preserved = currentLayouts[breakpoint].filter((item) => item.pageId !== pageId);
      const replacement = nextLayouts[breakpoint]
        .filter((item) => pageWidgetIds.has(item.i))
        .map((item) => ({
          i: item.i,
          pageId,
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

function widgetPreset(type: DashboardWidgetType, pageId: string): DashboardWidget {
  return {
    id: makeWidgetId(type),
    type,
    title: widgetLabel(type),
    pageId,
    static: false,
    isDraggable: true,
    isResizable: true
  };
}

function layoutPreset(widget: DashboardWidget, breakpoint: DashboardBreakpoint, y: number): DashboardLayoutItem {
  const size = widgetSizing(widget.type, breakpoint);
  return {
    i: widget.id,
    pageId: widget.pageId,
    x: 0,
    y,
    w: size.w,
    h: size.h,
    minW: size.minW,
    minH: size.minH,
    maxW: size.maxW,
    maxH: size.maxH,
    static: widget.static,
    isDraggable: widget.isDraggable,
    isResizable: widget.isResizable
  };
}

function autoPlacePageWidgets(widgets: DashboardWidget[], breakpoint: DashboardBreakpoint): DashboardLayoutItem[] {
  const cols = COLS[breakpoint];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  return widgets.map((widget) => {
    const size = widgetSizing(widget.type, breakpoint);
    if (cursorX > 0 && cursorX + size.w > cols) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }

    const item: DashboardLayoutItem = {
      i: widget.id,
      pageId: widget.pageId,
      x: cursorX,
      y: cursorY,
      w: size.w,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
      maxW: size.maxW,
      maxH: size.maxH,
      static: widget.static,
      isDraggable: widget.isDraggable,
      isResizable: widget.isResizable
    };

    cursorX += size.w;
    rowHeight = Math.max(rowHeight, size.h);
    if (cursorX >= cols) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }

    return item;
  });
}

function ensureWidgetsHaveLayouts(document: DashboardLayoutDocument): DashboardLayoutDocument {
  const widgetIds = new Set(document.widgets.map((widget) => widget.id));
  const nextLayouts = cloneResponsiveLayouts(document.layouts);

  for (const breakpoint of BREAKPOINT_KEYS) {
    nextLayouts[breakpoint] = nextLayouts[breakpoint].filter((item) => widgetIds.has(item.i));

    for (const widget of document.widgets) {
      if (nextLayouts[breakpoint].some((item) => item.i === widget.id)) {
        continue;
      }
      const bottomY = nextLayouts[breakpoint]
        .filter((item) => item.pageId === widget.pageId)
        .reduce((max, item) => Math.max(max, item.y + item.h), 0);
      nextLayouts[breakpoint].push(layoutPreset(widget, breakpoint, bottomY));
    }
  }

  return {
    ...document,
    layouts: nextLayouts
  };
}

function buildDefaultDashboardLayout(): DashboardLayoutDocument {
  const pages = renumberPages([createPage(0), createPage(1), createPage(2)]);

  const widgets: DashboardWidget[] = [
    { id: "status-primary", type: "status", title: "システムステータス", pageId: pages[0].id },
    { id: "cpu-primary", type: "cpu", title: "CPU使用率", pageId: pages[0].id },
    { id: "memory-primary", type: "memory", title: "メモリ使用率", pageId: pages[0].id },
    { id: "disk-primary", type: "disk", title: "ディスク使用率", pageId: pages[0].id },
    { id: "network-primary", type: "network", title: "ネットワーク状況", pageId: pages[0].id },
    { id: "chart-primary", type: "chart", title: "推移グラフ", pageId: pages[0].id },
    { id: "alerts-primary", type: "alert", title: "アラート一覧", pageId: pages[1].id },
    { id: "apps-primary", type: "applications", title: "アプリ一覧", pageId: pages[1].id },
    { id: "events-primary", type: "events", title: "イベント一覧", pageId: pages[1].id },
    { id: "jobs-primary", type: "jobs", title: "ジョブ一覧", pageId: pages[1].id },
    { id: "logs-primary", type: "log", title: "ログ一覧", pageId: pages[2].id }
  ];

  const layouts = Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => [
      breakpoint,
      pages.flatMap((page) =>
        autoPlacePageWidgets(
          widgets.filter((widget) => widget.pageId === page.id),
          breakpoint
        )
      )
    ])
  ) as DashboardResponsiveLayouts;

  return {
    version: 2,
    pages,
    widgets,
    layouts,
    currentPageId: pages[0].id
  };
}

function normalizeDashboardLayout(document: unknown): DashboardLayoutDocument {
  if (!isRecord(document)) {
    return buildDefaultDashboardLayout();
  }

  const rawPages = Array.isArray(document.pages)
    ? document.pages
        .filter(isRecord)
        .map((page, index) => ({
          id: hasString(page.id) ? page.id : makePageId(),
          title: hasString(page.title) ? page.title : dashboardPageTitle(index)
        }))
    : [];

  const legacyPageCount = typeof document.pageCount === "number" && Number.isFinite(document.pageCount)
    ? Math.max(1, Math.round(document.pageCount))
    : 0;

  const legacyPageNumbersFromWidgets = Array.isArray(document.widgets)
    ? document.widgets
        .filter(isRecord)
        .map((widget) => (typeof widget.page === "number" ? Math.max(0, Math.round(widget.page)) : 0))
    : [];

  const legacyLayoutSource = isRecord(document.layouts) ? document.layouts : null;

  const legacyPageNumbersFromLayouts = legacyLayoutSource
    ? BREAKPOINT_KEYS.flatMap((breakpoint) => {
        const items = legacyLayoutSource[breakpoint];
        return Array.isArray(items)
          ? items
              .filter(isRecord)
              .map((item) => (typeof item.page === "number" ? Math.max(0, Math.round(item.page)) : 0))
          : [];
      })
    : [];

  const derivedLegacyPageCount = Math.max(
    rawPages.length,
    legacyPageCount,
    (legacyPageNumbersFromWidgets.length > 0 ? Math.max(...legacyPageNumbersFromWidgets) + 1 : 0),
    (legacyPageNumbersFromLayouts.length > 0 ? Math.max(...legacyPageNumbersFromLayouts) + 1 : 0),
    1
  );

  const pages =
    rawPages.length > 0
      ? renumberPages(rawPages)
      : renumberPages(Array.from({ length: derivedLegacyPageCount }, (_, index) => createPage(index)));

  const pageIds = new Set(pages.map((page) => page.id));

  function normalizePageId(value: unknown): string {
    if (hasString(value) && pageIds.has(value)) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return pages[clamp(Math.round(value), 0, pages.length - 1)]?.id ?? pages[0].id;
    }
    return pages[0].id;
  }

  const widgets = Array.isArray(document.widgets)
    ? document.widgets
        .filter(isRecord)
        .flatMap((rawWidget, index) => {
          const widget = rawWidget as LegacyDashboardWidget;
          if (!hasWidgetType(widget.type)) {
            return [];
          }
          return [
            {
              id: hasString(widget.id) ? widget.id : makeWidgetId(widget.type),
              type: widget.type,
              title: hasString(widget.title) ? widget.title : widgetLabel(widget.type),
              pageId: normalizePageId(widget.pageId ?? widget.page),
              static: typeof widget.static === "boolean" ? widget.static : false,
              isDraggable: typeof widget.isDraggable === "boolean" ? widget.isDraggable : true,
              isResizable: typeof widget.isResizable === "boolean" ? widget.isResizable : true,
              config: isRecord(widget.config) ? widget.config : undefined
            } satisfies DashboardWidget
          ];
        })
    : buildDefaultDashboardLayout().widgets;

  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));

  function normalizeLayoutItems(items: unknown, breakpoint: DashboardBreakpoint): DashboardLayoutItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(isRecord)
      .flatMap((rawItem, index) => {
        const item = rawItem as LegacyDashboardLayoutItem;
        if (!hasString(item.i)) {
          return [];
        }
        const widget = widgetById.get(item.i);
        if (!widget) {
          return [];
        }

        const size = widgetSizing(widget.type, breakpoint);
        const w = Math.min(COLS[breakpoint], Math.max(size.minW, toPositiveInteger(item.w, size.w)));
        const h = Math.max(size.minH, toPositiveInteger(item.h, size.h));
        const minW = Math.min(COLS[breakpoint], Math.max(1, toPositiveInteger(item.minW, size.minW)));
        const minH = Math.max(1, toPositiveInteger(item.minH, size.minH));
        const maxW = typeof item.maxW === "number" ? Math.max(w, Math.round(item.maxW)) : size.maxW;
        const maxH = typeof item.maxH === "number" ? Math.max(h, Math.round(item.maxH)) : size.maxH;
        return [
          {
            i: item.i,
            pageId: normalizePageId(item.pageId ?? item.page ?? widget.pageId),
            x: Math.min(COLS[breakpoint] - 1, Math.max(0, toPositiveInteger(item.x, 0))),
            y: Math.max(0, toPositiveInteger(item.y, index * 2)),
            w,
            h,
            minW,
            minH,
            maxW,
            maxH,
            static: typeof item.static === "boolean" ? item.static : widget.static,
            isDraggable: typeof item.isDraggable === "boolean" ? item.isDraggable : widget.isDraggable,
            isResizable: typeof item.isResizable === "boolean" ? item.isResizable : widget.isResizable
          } satisfies DashboardLayoutItem
        ];
      });
  }

  const layoutsSource = isRecord(document.layouts) ? document.layouts : {};
  const normalizedLayouts = Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => [breakpoint, normalizeLayoutItems(layoutsSource[breakpoint], breakpoint)])
  ) as DashboardResponsiveLayouts;

  const currentPageId = normalizePageId(document.currentPageId ?? document.currentPage);

  return ensureWidgetsHaveLayouts({
    version: 2,
    pages,
    widgets,
    layouts: normalizedLayouts,
    currentPageId
  });
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

function findDisplayLayout(layouts: GridLayouts, breakpoint: DashboardBreakpoint, widgetId: string): GridItemLayout | null {
  const candidates: DashboardBreakpoint[] = [breakpoint, "lg", "md", "sm", "xs"];
  for (const candidate of candidates) {
    const match = layouts[candidate].find((item) => item.i === widgetId);
    if (match) {
      return match;
    }
  }
  return null;
}

function resolveWidgetMode(type: DashboardWidgetType, layout: GridItemLayout | null): WidgetVisualMode {
  if (!layout) {
    return "standard";
  }

  switch (type) {
    case "status":
      if (layout.w <= 6 || layout.h <= 3) {
        return "compact";
      }
      if (layout.w >= 10 && layout.h >= 5) {
        return "detail";
      }
      return "standard";
    case "cpu":
    case "memory":
    case "disk":
    case "network":
      if (layout.w <= 2 || layout.h <= 3) {
        return "compact";
      }
      if (layout.w >= 4 && layout.h >= 5) {
        return "detail";
      }
      return "standard";
    case "chart":
      if (layout.h <= 4) {
        return "compact";
      }
      if (layout.w >= 8 && layout.h >= 6) {
        return "detail";
      }
      return "standard";
    case "log":
      if (layout.h <= 4) {
        return "compact";
      }
      if (layout.w >= 8 && layout.h >= 7) {
        return "detail";
      }
      return "standard";
    case "alert":
    case "applications":
    case "jobs":
    case "events":
      if (layout.w <= 4 || layout.h <= 4) {
        return "compact";
      }
      if (layout.w >= 8 && layout.h >= 6) {
        return "detail";
      }
      return "standard";
    default:
      return "standard";
  }
}

function WidgetFrame(props: {
  widget: DashboardWidget;
  mode: WidgetVisualMode;
  editMode: boolean;
  layout: GridItemLayout | null;
  pageIndex: number;
  totalPages: number;
  breakpoint: DashboardBreakpoint;
  onDelete: (widgetId: string) => void;
  onMovePage: (widgetId: string, delta: -1 | 1) => void;
  children: ReactNode;
}) {
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

function MetricWidget(props: {
  icon: ReactNode;
  value: number;
  label: string;
  meta: string;
  mode: WidgetVisualMode;
  detailItems?: string[];
}) {
  const { icon, value, label, meta, mode, detailItems = [] } = props;
  const valueClass = mode === "compact" ? "text-2xl" : mode === "detail" ? "text-4xl" : "text-3xl";
  const iconPadding = mode === "detail" ? "p-3.5" : "p-3";

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-2xl bg-slate-100 text-slate-600 ${iconPadding}`}>{icon}</span>
        <div className="min-w-0 text-right">
          {mode !== "compact" ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p> : null}
          <p className={`${valueClass} font-bold text-slate-900`}>{value.toFixed(1)}%</p>
          <p className={`mt-1 ${mode === "compact" ? "text-xs text-slate-500" : "text-sm text-slate-500"}`}>
            {mode === "compact" ? label : meta}
          </p>
        </div>
      </div>

      {mode === "detail" && detailItems.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {detailItems.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {item}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${gaugeTone(value)}`} style={{ width: `${Math.max(8, value)}%` }} />
      </div>
    </div>
  );
}

function PreviewMetric(props: { type: DashboardWidgetType; accentClass: string }) {
  const { type, accentClass } = props;
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-2xl bg-slate-100 p-2.5 text-slate-600">{widgetIcon(type, "text-base")}</span>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{widgetLabel(type)}</p>
          <p className="text-2xl font-bold text-slate-900">63%</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: "63%" }} />
      </div>
    </div>
  );
}

function WidgetPreview(props: { type: DashboardWidgetType }) {
  const { type } = props;

  switch (type) {
    case "status":
      return (
        <div className="grid h-full grid-cols-2 gap-2">
          {[
            ["Apps", "12"],
            ["Healthy", "10"],
            ["Queue", "3"],
            ["Pages", "4"]
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`rounded-xl border p-3 ${
                index === 1
                  ? "border-emerald-200 bg-emerald-50"
                  : index === 2
                    ? "border-amber-200 bg-amber-50"
                    : index === 3
                      ? "border-violet-200 bg-violet-50"
                      : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      );
    case "cpu":
      return <PreviewMetric type={type} accentClass="bg-emerald-500" />;
    case "memory":
      return <PreviewMetric type={type} accentClass="bg-violet-500" />;
    case "disk":
      return <PreviewMetric type={type} accentClass="bg-amber-500" />;
    case "network":
      return (
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="rounded-2xl bg-slate-100 p-2.5 text-slate-600">{widgetIcon(type, "text-base")}</span>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">4</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">interfaces</p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-500">
            <div className="flex justify-between gap-2">
              <span>primary</span>
              <span className="font-mono text-slate-700">192.168.0.10</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>dns</span>
              <span className="font-semibold text-slate-700">enabled</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>domain</span>
              <span className="font-mono text-slate-700">lab.local</span>
            </div>
          </div>
        </div>
      );
    case "chart":
      return (
        <div className="flex h-full flex-col">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">trend</p>
            <FaChartLine className="text-slate-400" />
          </div>
          <div className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <svg viewBox="0 0 240 80" className="h-full w-full">
              <path d={sparklinePath([22, 38, 34, 44, 42, 58], 240, 80)} fill="none" stroke="#10b981" strokeWidth="3" />
              <path d={sparklinePath([12, 16, 28, 26, 34, 39], 240, 80)} fill="none" stroke="#8b5cf6" strokeWidth="3" />
              <path d={sparklinePath([48, 44, 50, 56, 52, 60], 240, 80)} fill="none" stroke="#f59e0b" strokeWidth="3" />
            </svg>
          </div>
        </div>
      );
    case "alert":
    case "applications":
    case "jobs":
    case "events":
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="h-2.5 w-20 rounded-full bg-slate-300" />
                <div className="h-2.5 w-10 rounded-full bg-white" />
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200" />
              <div className="mt-1.5 h-2.5 w-3/4 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      );
    case "log":
      return (
        <div className="flex h-full flex-col">
          <div className="mb-2 flex gap-2">
            <div className="h-8 flex-1 rounded-xl border border-slate-200 bg-white" />
            <div className="h-8 w-24 rounded-xl border border-slate-200 bg-white" />
          </div>
          <div className="min-h-0 flex-1 rounded-xl bg-slate-950 p-3 font-mono text-[10px] text-slate-300">
            <div className="space-y-1">
              <div>{"> boot sequence started"}</div>
              <div>{"> healthcheck ok"}</div>
              <div>{"> worker queue idle"}</div>
              <div>{"> waiting for next task"}</div>
            </div>
          </div>
        </div>
      );
    default:
      return <div className="text-sm text-slate-400">preview</div>;
  }
}

function WidgetPreviewCard(props: {
  type: DashboardWidgetType;
  breakpoint: DashboardBreakpoint;
  targetLabel: string;
  onSelect: (type: DashboardWidgetType) => void;
}) {
  const { type, breakpoint, targetLabel, onSelect } = props;
  const definition = widgetDefinition(type);
  const size = widgetSizing(type, breakpoint);

  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-white p-3 text-slate-600 shadow-sm">{widgetIcon(type)}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{definition.label}</p>
            <p className="mt-1 text-xs text-slate-500">{definition.description}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">{targetLabel}</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">default</p>
          <p className="text-sm font-bold text-slate-900">{formatGridSize(size.w, size.h)}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">minimum</p>
          <p className="text-sm font-bold text-slate-700">{formatGridSize(size.minW, size.minH)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.4rem] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="mx-auto w-full max-w-[240px]" style={{ aspectRatio: `${size.w} / ${Math.max(size.h, 1)}` }}>
          <div className="h-full overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white p-3 shadow-sm">
            <WidgetPreview type={type} />
          </div>
        </div>
      </div>
    </button>
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
  const [widgetPickerTarget, setWidgetPickerTarget] = useState<WidgetPickerTarget>("current");
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

  const currentPage = useMemo(() => {
    if (!dashboard) {
      return null;
    }
    return dashboard.pages.find((page) => page.id === dashboard.currentPageId) ?? dashboard.pages[0] ?? null;
  }, [dashboard]);

  const currentPageIndex = useMemo(() => {
    if (!dashboard || !currentPage) {
      return 0;
    }
    const index = dashboard.pages.findIndex((page) => page.id === currentPage.id);
    return index >= 0 ? index : 0;
  }, [dashboard, currentPage]);

  const currentLayouts = useMemo(
    () => (dashboard && currentPage ? toRglLayouts(dashboard, currentPage.id) : EMPTY_GRID_LAYOUTS),
    [dashboard, currentPage]
  );

  const widgetsOnCurrentPage = useMemo(
    () => (dashboard && currentPage ? dashboard.widgets.filter((widget) => widget.pageId === currentPage.id) : []),
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

  function changePage(nextPageIndex: number) {
    if (!dashboard) {
      return;
    }
    if (
      nextPageIndex < 0 ||
      nextPageIndex >= dashboard.pages.length ||
      nextPageIndex === currentPageIndex ||
      isLayoutInteracting ||
      isPageAnimating
    ) {
      return;
    }

    const nextPage = dashboard.pages[nextPageIndex];
    if (!nextPage) {
      return;
    }

    setIsPageAnimating(true);
    setDashboard((previous) => (previous ? { ...previous, currentPageId: nextPage.id } : previous));
    window.setTimeout(() => setIsPageAnimating(false), PAGE_ANIMATION_MS);
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
    changePage(currentPageIndex + (event.deltaY > 0 ? 1 : -1));
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

    changePage(currentPageIndex + (diff > 0 ? 1 : -1));
    setTouchStartY(null);
    touchScrollLockRef.current = false;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      changePage(currentPageIndex + 1);
    }
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      changePage(currentPageIndex - 1);
    }
  }

  function updateLayouts(nextLayouts: GridLayouts) {
    setDashboard((previous) => {
      if (!previous || !currentPage) {
        return previous;
      }

      return {
        ...previous,
        layouts: mergeLayoutsForPage(previous.layouts, currentPage.id, nextLayouts, previous.widgets)
      };
    });
  }

  function addPage() {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const pages = renumberPages([...previous.pages, createPage(previous.pages.length)]);
      const nextPage = pages[pages.length - 1];
      if (!nextPage) {
        return previous;
      }

      return {
        ...previous,
        pages,
        currentPageId: nextPage.id
      };
    });
  }

  function removeCurrentPage() {
    if (!dashboard || !currentPage) {
      return;
    }
    if (dashboard.pages.length <= 1 || widgetsOnCurrentPage.length > 0) {
      return;
    }
    if (!window.confirm("空のページを削除しますか？")) {
      return;
    }

    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const index = previous.pages.findIndex((page) => page.id === previous.currentPageId);
      if (index < 0 || previous.pages.length <= 1) {
        return previous;
      }

      const pages = renumberPages(previous.pages.filter((page) => page.id !== previous.currentPageId));
      const fallbackIndex = clamp(index - 1, 0, pages.length - 1);
      const fallbackPage = pages[fallbackIndex];
      if (!fallbackPage) {
        return previous;
      }

      return {
        ...previous,
        pages,
        currentPageId: fallbackPage.id
      };
    });
  }

  function addWidget(type: DashboardWidgetType, target: WidgetPickerTarget) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      let pages = previous.pages;
      let targetPageId = previous.currentPageId;

      if (target === "new-page") {
        pages = renumberPages([...previous.pages, createPage(previous.pages.length)]);
        targetPageId = pages[pages.length - 1]?.id ?? previous.currentPageId;
      }

      const widget = widgetPreset(type, targetPageId);
      const nextLayouts = cloneResponsiveLayouts(previous.layouts);
      for (const bp of BREAKPOINT_KEYS) {
        const pageItems = nextLayouts[bp].filter((item) => item.pageId === targetPageId);
        const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        nextLayouts[bp].push(layoutPreset(widget, bp, bottomY));
      }

      return {
        ...previous,
        pages,
        currentPageId: targetPageId,
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
          BREAKPOINT_KEYS.map((bp) => [bp, previous.layouts[bp].filter((item) => item.i !== widgetId)])
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

      const currentIndex = previous.pages.findIndex((page) => page.id === widget.pageId);
      if (currentIndex < 0) {
        return previous;
      }

      let pages = previous.pages;
      let targetIndex = currentIndex + delta;

      if (delta === 1 && targetIndex >= pages.length) {
        pages = renumberPages([...pages, createPage(pages.length)]);
        targetIndex = pages.length - 1;
      }

      if (targetIndex < 0 || targetIndex >= pages.length) {
        return previous;
      }

      const targetPage = pages[targetIndex];
      if (!targetPage || targetPage.id === widget.pageId) {
        return previous;
      }

      const widgets = previous.widgets.map((candidate) =>
        candidate.id === widgetId ? { ...candidate, pageId: targetPage.id } : candidate
      );

      const layouts = Object.fromEntries(
        BREAKPOINT_KEYS.map((bp) => {
          const pageItems = previous.layouts[bp].filter((item) => item.pageId === targetPage.id);
          const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);
          return [
            bp,
            previous.layouts[bp].map((item) =>
              item.i === widgetId
                ? {
                    ...item,
                    pageId: targetPage.id,
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
        pages,
        widgets,
        layouts,
        currentPageId: targetPage.id
      };
    });
  }

  const chartPathCpu = sparklinePath(metricsHistory.map((item) => item.cpu), 320, 96);
  const chartPathMemory = sparklinePath(metricsHistory.map((item) => item.memory), 320, 96);
  const chartPathDisk = sparklinePath(metricsHistory.map((item) => item.disk), 320, 96);

  function renderWidget(widget: DashboardWidget, layout: GridItemLayout | null, pageIndex: number): ReactNode {
    const mode = resolveWidgetMode(widget.type, layout);
    const totalPages = dashboard?.pages.length ?? 1;
    const frameProps = {
      widget,
      mode,
      editMode,
      layout,
      pageIndex,
      totalPages,
      breakpoint,
      onDelete: deleteWidget,
      onMovePage: moveWidgetPage
    };

    switch (widget.type) {
      case "status": {
        const summaryCards = [
          {
            label: "Apps",
            value: system?.applicationSummary.total ?? applications.length,
            tone: "border-slate-200 bg-slate-50",
            textTone: "text-slate-900",
            meta: `登録 ${applications.length}`
          },
          {
            label: "Healthy",
            value: applications.filter((application) => application.health?.severity === "ok").length,
            tone: "border-emerald-200 bg-emerald-50",
            textTone: "text-emerald-900",
            meta: "安定稼働"
          },
          {
            label: "Queue",
            value: jobs.filter((job) => job.status !== "succeeded").length,
            tone: "border-amber-200 bg-amber-50",
            textTone: "text-amber-900",
            meta: "待機・要確認"
          },
          {
            label: "Pages",
            value: dashboard?.pages.length ?? 0,
            tone: "border-violet-200 bg-violet-50",
            textTone: "text-violet-900",
            meta: `widgets ${dashboard?.widgets.length ?? 0}`
          }
        ];

        return (
          <WidgetFrame {...frameProps}>
            <div className={`grid h-full gap-3 ${mode === "compact" ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
              {summaryCards.map((card) => (
                <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                  <p className={`mt-3 ${mode === "detail" ? "text-4xl" : "text-3xl"} font-bold ${card.textTone}`}>{card.value}</p>
                  {mode !== "compact" ? <p className="mt-2 text-sm text-slate-500">{card.meta}</p> : null}
                </div>
              ))}
            </div>
            {mode === "detail" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  実行モード: <span className="font-semibold text-slate-900">{system?.execution?.mode ?? "unknown"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  DNS: <span className="font-semibold text-slate-900">{metrics?.network.dnsEnabled ? "enabled" : "disabled"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Root Domain: <span className="font-mono text-slate-900">{metrics?.network.rootDomain ?? "--"}</span>
                </div>
              </div>
            ) : null}
          </WidgetFrame>
        );
      }
      case "cpu":
        return (
          <WidgetFrame {...frameProps}>
            <MetricWidget
              icon={widgetIcon(widget.type)}
              value={metrics?.cpu.usagePercent ?? 0}
              label="CPU使用率"
              meta={`load avg ${metrics?.cpu.loadAverage1m ?? 0} / ${metrics?.cpu.coreCount ?? 0} cores`}
              mode={mode}
              detailItems={[
                `1m ${metrics?.cpu.loadAverage1m ?? 0}`,
                `5m ${metrics?.cpu.loadAverage5m ?? 0}`,
                `15m ${metrics?.cpu.loadAverage15m ?? 0}`,
                `cores ${metrics?.cpu.coreCount ?? 0}`
              ]}
            />
          </WidgetFrame>
        );
      case "memory":
        return (
          <WidgetFrame {...frameProps}>
            <MetricWidget
              icon={widgetIcon(widget.type)}
              value={metrics?.memory.usagePercent ?? 0}
              label="メモリ使用率"
              meta={`${formatBytes(metrics?.memory.usedBytes ?? 0)} / ${formatBytes(metrics?.memory.totalBytes ?? 0)}`}
              mode={mode}
              detailItems={[
                `used ${formatBytes(metrics?.memory.usedBytes ?? 0)}`,
                `free ${formatBytes(metrics?.memory.freeBytes ?? 0)}`,
                `total ${formatBytes(metrics?.memory.totalBytes ?? 0)}`
              ]}
            />
          </WidgetFrame>
        );
      case "disk":
        return (
          <WidgetFrame {...frameProps}>
            <MetricWidget
              icon={widgetIcon(widget.type)}
              value={metrics?.disk.usagePercent ?? 0}
              label="ディスク使用率"
              meta={`${formatBytes(metrics?.disk.usedBytes ?? 0)} / ${formatBytes(metrics?.disk.totalBytes ?? 0)}`}
              mode={mode}
              detailItems={[
                `path ${metrics?.disk.path ?? "/"}`,
                `free ${formatBytes(metrics?.disk.freeBytes ?? 0)}`,
                `total ${formatBytes(metrics?.disk.totalBytes ?? 0)}`
              ]}
            />
          </WidgetFrame>
        );
      case "network": {
        const interfaces = metrics?.network.interfaces ?? [];
        const shownInterfaces = interfaces.slice(0, mode === "compact" ? 0 : mode === "detail" ? 4 : 2);

        return (
          <WidgetFrame {...frameProps}>
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-2xl bg-slate-100 p-3 text-slate-600">{widgetIcon(widget.type)}</span>
                <div className="text-right">
                  <p className={`${mode === "detail" ? "text-4xl" : "text-3xl"} font-bold text-slate-900`}>
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
      case "alert": {
        const items = (metrics?.alerts ?? []).slice(0, mode === "compact" ? 3 : mode === "detail" ? 8 : 5);

        return (
          <WidgetFrame {...frameProps}>
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">warning / error</p>
                <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenEvents}>
                  すべて見る
                </button>
              </div>
              <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
                {items.map((alert) => (
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
                    {mode !== "compact" ? (
                      <p className={`mt-1 whitespace-pre-wrap text-sm text-slate-600 ${mode === "detail" ? "line-clamp-4" : "line-clamp-2"}`}>
                        {alert.message}
                      </p>
                    ) : null}
                  </div>
                ))}
                {items.length === 0 ? <p className="text-sm text-slate-400">現在アラートはありません。</p> : null}
              </div>
            </div>
          </WidgetFrame>
        );
      }
      case "chart": {
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
              {mode === "detail" && latest ? (
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
      case "applications": {
        const shownApplications = applications.slice(0, mode === "compact" ? 4 : mode === "detail" ? 10 : 6);
        return (
          <WidgetFrame {...frameProps}>
            <div className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">アプリケーション</p>
                <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenApplications}>
                  管理画面へ
                </button>
              </div>
              <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
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
                        {mode !== "compact" ? <p className="mt-1 truncate text-xs text-slate-400">{application.hostname}</p> : null}
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
      case "jobs": {
        const shownJobs = jobs.slice(0, mode === "compact" ? 4 : mode === "detail" ? 10 : 6);
        return (
          <WidgetFrame {...frameProps}>
            <div className={`h-full overflow-y-auto pr-1 ${mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
              {shownJobs.map((job) => (
                <div key={job.job_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{jobTypeLabel(job.type)}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{jobStatusLabel(job.status)}</span>
                  </div>
                  {mode !== "compact" ? (
                    <>
                      <p className="mt-1 text-xs text-slate-400">{job.application_name ?? "system"} / {formatRelative(job.created_at)}</p>
                      {job.message ? <p className={`mt-2 text-sm text-slate-600 ${mode === "detail" ? "line-clamp-3" : "line-clamp-2"}`}>{job.message}</p> : null}
                    </>
                  ) : null}
                </div>
              ))}
              {shownJobs.length === 0 ? <p className="text-sm text-slate-400">ジョブはありません。</p> : null}
            </div>
          </WidgetFrame>
        );
      }
      case "events": {
        const shownEvents = events.slice(0, mode === "compact" ? 4 : mode === "detail" ? 10 : 6);
        return (
          <WidgetFrame {...frameProps}>
            <div className={`h-full overflow-y-auto pr-1 ${mode === "compact" ? "space-y-2" : "space-y-3"}`} data-widget-scrollable="true">
              {shownEvents.map((event) => (
                <div key={event.event_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{event.title}</p>
                    {mode !== "compact" ? <span className="text-[11px] text-slate-400">{toLocale(event.created_at)}</span> : null}
                  </div>
                  {mode !== "compact" ? (
                    <>
                      <p className="mt-1 text-xs text-slate-400">{event.application_name ?? event.scope ?? "system"}</p>
                      <p className={`mt-2 whitespace-pre-wrap text-sm text-slate-600 ${mode === "detail" ? "line-clamp-4" : "line-clamp-2"}`}>{event.message}</p>
                    </>
                  ) : null}
                </div>
              ))}
              {shownEvents.length === 0 ? <p className="text-sm text-slate-400">イベントはありません。</p> : null}
            </div>
          </WidgetFrame>
        );
      }
      case "log": {
        const activeApp = applications.find((application) => application.application_id === logWidget.applicationId) ?? null;
        const visibleLines = logWidget.lines.slice(mode === "compact" ? -18 : mode === "detail" ? -80 : -40);

        return (
          <WidgetFrame {...frameProps}>
            <div className="flex h-full flex-col">
              <div className={`mb-3 flex flex-wrap items-center gap-2 ${mode === "compact" ? "" : "justify-between"}`}>
                <div className="flex flex-wrap items-center gap-2">
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
                </div>
                {mode !== "compact" ? <span className="text-xs text-slate-400">{activeApp ? activeApp.hostname : "ログ対象なし"}</span> : null}
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
              {mode !== "compact" ? (
                <div className="mt-2 text-[11px] text-slate-400">{logWidget.fetchedAt ? `${toLocale(logWidget.fetchedAt)} 取得` : "未取得"}</div>
              ) : null}
            </div>
          </WidgetFrame>
        );
      }
      default:
        return (
          <WidgetFrame {...frameProps}>
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
          <h2 className="mt-1 text-lg font-bold text-slate-900">固定トピックに縛られない、可変ページ型の監視ワークスペース</h2>
          <p className="mt-1 text-sm text-slate-500">ページは必要な分だけ増やせて、各ウィジェットは最小サイズとサイズ別表示を持ちます。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              saveState === "error"
                ? "bg-rose-100 text-rose-700"
                : saveState === "saving"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {saveState === "saving" ? "レイアウト保存中" : saveState === "error" ? "保存失敗" : "保存済み"}
          </span>
          <button
            type="button"
            onClick={addPage}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ページ追加
          </button>
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
            onClick={() => {
              setWidgetPickerTarget("current");
              setWidgetPickerOpen(true);
            }}
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
            style={{ transform: `translateY(-${currentPageIndex * 100}%)` }}
          >
            {(dashboard?.pages ?? []).map((page, pageIndex) => {
              const pageLayouts = dashboard
                ? page.id === currentPage?.id
                  ? currentLayouts
                  : toRglLayouts(dashboard, page.id)
                : EMPTY_GRID_LAYOUTS;
              const pageWidgets = dashboard?.widgets.filter((widget) => widget.pageId === page.id) ?? [];

              return (
                <section key={page.id} className="h-full min-h-0 shrink-0 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">{pageBadgeLabel(pageIndex)}</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">{page.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {pageWidgets.length} widgets · {COLS[breakpoint]} cols · min-size aware
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>12px gap</span>
                      <span>drag / resize enabled</span>
                      {page.id === currentPage?.id && editMode && pageWidgets.length === 0 && (dashboard?.pages.length ?? 0) > 1 ? (
                        <button
                          type="button"
                          onClick={removeCurrentPage}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          空ページ削除
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative h-[calc(100%-4rem)] min-h-0 rounded-[1.8rem] border border-white/80 bg-white/65 shadow-[0_26px_80px_-60px_rgba(15,23,42,0.6)] backdrop-blur">
                    {dashboard ? (
                      <>
                        <ResponsiveGridLayout
                          className="layout h-full"
                          breakpoints={BREAKPOINTS}
                          cols={COLS}
                          rowHeight={ROW_HEIGHT}
                          margin={GRID_MARGIN}
                          containerPadding={CONTAINER_PADDING}
                          layouts={pageLayouts}
                          isDraggable={editMode}
                          isResizable={editMode}
                          draggableHandle=".widget-drag-handle"
                          preventCollision={false}
                          allowOverlap={false}
                          compactType="vertical"
                          resizeHandles={["se"]}
                          onBreakpointChange={(nextBreakpoint: string) => setBreakpoint(nextBreakpoint as DashboardBreakpoint)}
                          onLayoutChange={(_: unknown, nextLayouts: unknown) => {
                            if (page.id !== currentPage?.id) {
                              return;
                            }
                            updateLayouts(nextLayouts as GridLayouts);
                          }}
                          onDragStart={() => setIsLayoutInteracting(true)}
                          onDragStop={() => setIsLayoutInteracting(false)}
                          onResizeStart={() => setIsLayoutInteracting(true)}
                          onResizeStop={() => setIsLayoutInteracting(false)}
                        >
                          {pageWidgets.map((widget) => (
                            <div key={widget.id} className="overflow-hidden">
                              {renderWidget(widget, findDisplayLayout(pageLayouts, breakpoint, widget.id), pageIndex)}
                            </div>
                          ))}
                        </ResponsiveGridLayout>

                        {pageWidgets.length === 0 ? (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                            <div className="max-w-md rounded-[1.6rem] border border-dashed border-slate-300 bg-white/90 px-6 py-8 text-center shadow-sm">
                              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">{pageBadgeLabel(pageIndex)}</p>
                              <h4 className="mt-2 text-lg font-bold text-slate-900">このページはまだ空です</h4>
                              <p className="mt-2 text-sm text-slate-500">
                                必要なウィジェットを追加するか、新しいページへそのまま拡張してください。
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="hidden w-24 shrink-0 flex-col items-center justify-center gap-3 pr-4 lg:flex">
          <button
            type="button"
            onClick={addPage}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            title="ページ追加"
          >
            <FaPlus />
          </button>
          {(dashboard?.pages ?? []).map((page, pageIndex) => (
            <button
              key={page.id}
              type="button"
              onClick={() => changePage(pageIndex)}
              className={`group flex items-center gap-3 ${pageIndex === currentPageIndex ? "text-slate-900" : "text-slate-400"}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  pageIndex === currentPageIndex ? "bg-violet-600" : "bg-slate-300 group-hover:bg-slate-400"
                }`}
              />
              <span className="text-xs font-semibold">{pageIndex + 1}</span>
            </button>
          ))}
        </aside>
      </div>

      {widgetPickerOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Add Widget</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">追加前に、実際のサイズと UI を見ながら選択</h3>
                <p className="mt-1 text-sm text-slate-500">表示中の幅 `{breakpoint}` を基準に、デフォルトサイズと最小サイズを `n×m` で表示します。</p>
              </div>
              <button
                type="button"
                onClick={() => setWidgetPickerOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                閉じる
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWidgetPickerTarget("current")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  widgetPickerTarget === "current"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                現在の {pageBadgeLabel(currentPageIndex)} に追加
              </button>
              <button
                type="button"
                onClick={() => setWidgetPickerTarget("new-page")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  widgetPickerTarget === "new-page"
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                新しいページを作成して追加
              </button>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {WIDGET_ORDER.map((type) => (
                <WidgetPreviewCard
                  key={type}
                  type={type}
                  breakpoint={breakpoint}
                  targetLabel={
                    widgetPickerTarget === "current"
                      ? `${pageBadgeLabel(currentPageIndex)} に追加`
                      : "新しいページに追加"
                  }
                  onSelect={(nextType) => addWidget(nextType, widgetPickerTarget)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

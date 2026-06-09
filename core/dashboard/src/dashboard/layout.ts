import type {
  DashboardBreakpoint,
  DashboardLayoutDocument,
  DashboardLayoutItem,
  DashboardResponsiveLayouts,
  DashboardWidget,
  DashboardWidgetType
} from "../types";
import { BREAKPOINT_KEYS, COLS } from "./constants";
import type { GridItemLayout, GridLayouts } from "./types";
import { WIDGET_ORDER, widgetLabel, widgetSizing } from "./widgetDefinitions";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasWidgetType(value: unknown): value is DashboardWidgetType {
  return typeof value === "string" && WIDGET_ORDER.includes(value as DashboardWidgetType);
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

function createPage(index: number) {
  return {
    id: makePageId(),
    title: dashboardPageTitle(index)
  };
}

export function renumberPages(pages: Array<{ id: string; title: string }>) {
  return pages.map((page, index) => ({
    ...page,
    title: dashboardPageTitle(index)
  }));
}

export function cloneResponsiveLayouts(layouts: DashboardResponsiveLayouts): DashboardResponsiveLayouts {
  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => [
      breakpoint,
      layouts[breakpoint].map((item) => ({ ...item }))
    ])
  ) as DashboardResponsiveLayouts;
}

export function toRglLayouts(document: DashboardLayoutDocument, pageId: string): GridLayouts {
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

export function mergeLayoutsForPage(
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

export function widgetPreset(type: DashboardWidgetType, pageId: string): DashboardWidget {
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

export function layoutPreset(widget: DashboardWidget, breakpoint: DashboardBreakpoint, y: number): DashboardLayoutItem {
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

export function buildDefaultDashboardLayout(): DashboardLayoutDocument {
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

export function normalizeDashboardLayout(document: unknown): DashboardLayoutDocument {
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

  const legacyPageCount =
    typeof document.pageCount === "number" && Number.isFinite(document.pageCount) ? Math.max(1, Math.round(document.pageCount)) : 0;

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
    legacyPageNumbersFromWidgets.length > 0 ? Math.max(...legacyPageNumbersFromWidgets) + 1 : 0,
    legacyPageNumbersFromLayouts.length > 0 ? Math.max(...legacyPageNumbersFromLayouts) + 1 : 0,
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
        .flatMap((rawWidget) => {
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

export function findDisplayLayout(layouts: GridLayouts, breakpoint: DashboardBreakpoint, widgetId: string): GridItemLayout | null {
  const candidates: DashboardBreakpoint[] = [breakpoint, "lg", "md", "sm", "xs"];
  for (const candidate of candidates) {
    const match = layouts[candidate].find((item) => item.i === widgetId);
    if (match) {
      return match;
    }
  }
  return null;
}

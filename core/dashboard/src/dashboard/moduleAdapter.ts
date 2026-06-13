import type {
  DashboardBreakpoint,
  DashboardLayoutDocument,
  DashboardLayoutItem,
  DashboardPage,
  DashboardResponsiveLayouts,
  DashboardWidget,
  DashboardWidgetType
} from "../types";
import { BREAKPOINT_KEYS, COLS } from "./constants";
import { findFreeSpace, isRectFree } from "./gridModule/collision";
import type { Rect, WidgetLayout as ModuleWidgetLayout, WidgetTemplate } from "./gridModule/types";
import { widgetLabel, widgetSizing } from "./widgetDefinitions";

type SharedPlacement = {
  page: number;
  positions: Record<DashboardBreakpoint, Rect>;
};

type WidgetConstraints = {
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
};

function dashboardPageTitle(index: number): string {
  return `Page ${index + 1}`;
}

function makePageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeWidgetId(type: DashboardWidgetType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPage(index: number): DashboardPage {
  return {
    id: makePageId(),
    title: dashboardPageTitle(index),
    isDraft: false
  };
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function pageIndexById(pages: DashboardPage[]): Map<string, number> {
  return new Map(pages.map((page, index) => [page.id, index]));
}

function widgetLayoutItem(
  layouts: DashboardResponsiveLayouts,
  breakpoint: DashboardBreakpoint,
  widgetId: string
): DashboardLayoutItem | undefined {
  return layouts[breakpoint].find((item) => item.i === widgetId);
}

function alignPages(pages: DashboardPage[], count: number): DashboardPage[] {
  const minimumCount = Math.max(1, count);
  const nextPages = Array.from({ length: minimumCount }, (_, index) => {
    const existing = pages[index];
    return {
      id: existing?.id ?? makePageId(),
      title: dashboardPageTitle(index),
      isDraft: false
    };
  });

  return nextPages;
}

function coerceWidgetConstraints(
  type: DashboardWidgetType,
  breakpoint: DashboardBreakpoint,
  item: DashboardLayoutItem | undefined,
  maxRows: number
): WidgetConstraints {
  const definition = widgetSizing(type, breakpoint);
  const maxGridWidth = COLS[breakpoint];
  const safeMaxRows = Math.max(1, maxRows);

  const minW = clampInteger(item?.minW, definition.minW, 1, maxGridWidth);
  const minH = clampInteger(item?.minH, definition.minH, 1, safeMaxRows);
  const maxW = clampInteger(item?.maxW, definition.maxW ?? maxGridWidth, minW, maxGridWidth);
  const maxH = clampInteger(item?.maxH, definition.maxH ?? safeMaxRows, minH, safeMaxRows);
  const w = clampInteger(item?.w, definition.w, minW, maxW);
  const h = clampInteger(item?.h, definition.h, minH, maxH);

  return {
    w,
    h,
    minW,
    minH,
    maxW,
    maxH
  };
}

function buildWidgetTemplate(
  widget: DashboardWidget,
  breakpoint: DashboardBreakpoint,
  page: number,
  item: DashboardLayoutItem | undefined,
  maxRows: number,
  position?: { x: number; y: number }
): WidgetTemplate {
  const size = coerceWidgetConstraints(widget.type, breakpoint, item, maxRows);

  return {
    id: widget.id,
    type: widget.type,
    page,
    x: position?.x ?? clampInteger(item?.x, 0, 0, Math.max(0, COLS[breakpoint] - size.w)),
    y: position?.y ?? clampInteger(item?.y, 0, 0, Math.max(0, maxRows - size.h)),
    w: size.w,
    h: size.h,
    minW: size.minW,
    minH: size.minH,
    maxW: size.maxW,
    maxH: size.maxH,
    locked: widget.static ?? false,
    draggable: widget.isDraggable ?? true,
    resizable: widget.isResizable ?? true
  };
}

function toModuleWidgetLayout(template: WidgetTemplate): ModuleWidgetLayout {
  return {
    id: template.id,
    type: template.type,
    page: template.page ?? 0,
    x: template.x ?? 0,
    y: template.y ?? 0,
    w: template.w ?? template.minW,
    h: template.h ?? template.minH,
    minW: template.minW,
    minH: template.minH,
    maxW: template.maxW,
    maxH: template.maxH,
    locked: template.locked,
    draggable: template.draggable,
    resizable: template.resizable
  };
}

function toDashboardLayoutItem(layout: ModuleWidgetLayout, pageId: string): DashboardLayoutItem {
  return {
    i: layout.id,
    pageId,
    x: layout.x,
    y: layout.y,
    w: layout.w,
    h: layout.h,
    minW: layout.minW,
    minH: layout.minH,
    maxW: layout.maxW,
    maxH: layout.maxH,
    static: layout.locked,
    isDraggable: layout.draggable,
    isResizable: layout.resizable
  };
}

function createWidget(type: DashboardWidgetType, pageId: string): DashboardWidget {
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

function sortWidgetsForPlacement(
  document: DashboardLayoutDocument,
  primaryBreakpoint: DashboardBreakpoint
): DashboardWidget[] {
  const pageOrder = pageIndexById(document.pages);
  const layoutOrder = new Map(
    document.layouts[primaryBreakpoint].map((item) => [
      item.i,
      {
        y: item.y,
        x: item.x
      }
    ])
  );

  return [...document.widgets].sort((left, right) => {
    const leftPage = pageOrder.get(left.pageId) ?? Number.MAX_SAFE_INTEGER;
    const rightPage = pageOrder.get(right.pageId) ?? Number.MAX_SAFE_INTEGER;
    const leftPosition = layoutOrder.get(left.id);
    const rightPosition = layoutOrder.get(right.id);

    return (
      leftPage - rightPage ||
      (leftPosition?.y ?? Number.MAX_SAFE_INTEGER) - (rightPosition?.y ?? Number.MAX_SAFE_INTEGER) ||
      (leftPosition?.x ?? Number.MAX_SAFE_INTEGER) - (rightPosition?.x ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id)
    );
  });
}

function buildOccupiedLayouts(
  document: DashboardLayoutDocument,
  maxRows: number,
  excludeWidgetId?: string
): Record<DashboardBreakpoint, ModuleWidgetLayout[]> {
  const pages = pageIndexById(document.pages);

  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => {
      const layouts = document.widgets
        .filter((widget) => widget.id !== excludeWidgetId)
        .map((widget) => {
          const item = widgetLayoutItem(document.layouts, breakpoint, widget.id);
          const page = pages.get(widget.pageId) ?? 0;
          return toModuleWidgetLayout(buildWidgetTemplate(widget, breakpoint, page, item, maxRows));
        });

      return [breakpoint, layouts];
    })
  ) as Record<DashboardBreakpoint, ModuleWidgetLayout[]>;
}

function requestedRectForPlacement(
  template: WidgetTemplate,
  page: number
): Rect {
  return {
    page,
    x: template.x ?? 0,
    y: template.y ?? 0,
    w: template.w ?? template.minW,
    h: template.h ?? template.minH
  };
}

function findPlacementForBreakpoint(
  occupied: ModuleWidgetLayout[],
  template: WidgetTemplate,
  breakpoint: DashboardBreakpoint,
  maxRows: number,
  page: number,
  allowExpandedRows = false
): Rect | null {
  const requested = requestedRectForPlacement(template, page);
  const baseGrid = { cols: COLS[breakpoint], rows: maxRows };

  if (isRectFree(occupied, requested, baseGrid)) {
    return requested;
  }

  const free = findFreeSpace({
    widgets: occupied,
    grid: baseGrid,
    page,
    size: { w: requested.w, h: requested.h }
  });

  if (free) {
    return free;
  }

  if (!allowExpandedRows) {
    return null;
  }

  const pageBottom = occupied
    .filter((layout) => layout.page === page)
    .reduce((bottom, layout) => Math.max(bottom, layout.y + layout.h), 0);
  const expandedRows = Math.max(maxRows, pageBottom + requested.h);
  const expandedGrid = { cols: COLS[breakpoint], rows: expandedRows };

  return (
    findFreeSpace({
      widgets: occupied,
      grid: expandedGrid,
      page,
      size: { w: requested.w, h: requested.h }
    }) ?? null
  );
}

function findPrimaryPlacement(
  occupied: ModuleWidgetLayout[],
  template: WidgetTemplate,
  breakpoint: DashboardBreakpoint,
  maxRows: number,
  preferredPage: number
): Rect {
  const safePreferredPage = Math.max(0, preferredPage);
  const maxOccupiedPage = Math.max(0, ...occupied.map((layout) => layout.page));

  for (let page = safePreferredPage; page <= Math.max(maxOccupiedPage + 1, safePreferredPage); page += 1) {
    const placement = findPlacementForBreakpoint(occupied, template, breakpoint, maxRows, page, false);
    if (placement) {
      return placement;
    }
  }

  const placement = findPlacementForBreakpoint(
    occupied,
    template,
    breakpoint,
    maxRows,
    Math.max(maxOccupiedPage + 1, safePreferredPage),
    false
  );

  if (!placement) {
    throw new Error("主要ブレークポイントで配置位置を見つけられませんでした。");
  }

  return placement;
}

function pageIndexForCurrentPage(document: DashboardLayoutDocument): number {
  const index = document.pages.findIndex((page) => page.id === document.currentPageId);
  return index >= 0 ? index : 0;
}

function mergeWidgetLayouts(
  baseLayouts: DashboardResponsiveLayouts,
  widget: DashboardWidget,
  pageId: string,
  placement: SharedPlacement,
  maxRows: number
): DashboardResponsiveLayouts {
  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => {
      const currentItem = widgetLayoutItem(baseLayouts, breakpoint, widget.id);
      const template = buildWidgetTemplate(
        widget,
        breakpoint,
        placement.page,
        currentItem,
        maxRows,
        placement.positions[breakpoint]
      );

      const nextItem = toDashboardLayoutItem(toModuleWidgetLayout(template), pageId);
      const preserved = baseLayouts[breakpoint].filter((item) => item.i !== widget.id);
      return [breakpoint, [...preserved, nextItem]];
    })
  ) as DashboardResponsiveLayouts;
}

export function sanitizeDashboardDocument(
  document: DashboardLayoutDocument,
  maxRows: number,
  strictBreakpoint?: DashboardBreakpoint
): DashboardLayoutDocument {
  const safeMaxRows = Math.max(1, maxRows);
  const primaryBreakpoint = strictBreakpoint ?? "lg";
  const sortedWidgets = sortWidgetsForPlacement(document, primaryBreakpoint);
  const originalPageOrder = pageIndexById(document.pages);
  const placedLayouts = Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => [breakpoint, [] as ModuleWidgetLayout[]])
  ) as Record<DashboardBreakpoint, ModuleWidgetLayout[]>;
  const assignedPages = new Map<string, number>();

  for (const widget of sortedWidgets) {
    const preferredPage = originalPageOrder.get(widget.pageId) ?? 0;
    const templates = Object.fromEntries(
      BREAKPOINT_KEYS.map((breakpoint) => {
        const item = widgetLayoutItem(document.layouts, breakpoint, widget.id);
        return [breakpoint, buildWidgetTemplate(widget, breakpoint, preferredPage, item, safeMaxRows)];
      })
    ) as Record<DashboardBreakpoint, WidgetTemplate>;

    const primaryPlacement = findPrimaryPlacement(
      placedLayouts[primaryBreakpoint],
      templates[primaryBreakpoint],
      primaryBreakpoint,
      safeMaxRows,
      preferredPage
    );
    const positions = {
      [primaryBreakpoint]: primaryPlacement
    } as Record<DashboardBreakpoint, Rect>;
    assignedPages.set(widget.id, primaryPlacement.page);

    for (const breakpoint of BREAKPOINT_KEYS) {
      if (breakpoint === primaryBreakpoint) {
        continue;
      }

      const placement =
        findPlacementForBreakpoint(
          placedLayouts[breakpoint],
          templates[breakpoint],
          breakpoint,
          safeMaxRows,
          primaryPlacement.page,
          true
        ) ?? requestedRectForPlacement(templates[breakpoint], primaryPlacement.page);

      positions[breakpoint] = placement;
    }

    for (const breakpoint of BREAKPOINT_KEYS) {
      placedLayouts[breakpoint].push(
        toModuleWidgetLayout({
          ...templates[breakpoint],
          page: primaryPlacement.page,
          x: positions[breakpoint].x,
          y: positions[breakpoint].y
        })
      );
    }
  }

  const pageCount = Math.max(1, ...Array.from(assignedPages.values(), (page) => page + 1), 1);
  const pages = alignPages(document.pages, pageCount);
  const pageIdsByIndex = pages.map((page) => page.id);
  const currentPageIndex = Math.min(pageIndexForCurrentPage(document), pages.length - 1);
  const widgets = sortedWidgets.map((widget) => ({
    ...widget,
    pageId: pageIdsByIndex[assignedPages.get(widget.id) ?? 0] ?? pages[0].id
  }));

  return {
    ...document,
    pages,
    widgets,
    layouts: Object.fromEntries(
      BREAKPOINT_KEYS.map((breakpoint) => [
        breakpoint,
        placedLayouts[breakpoint].map((layout) =>
          toDashboardLayoutItem(layout, pageIdsByIndex[layout.page] ?? pages[0].id)
        )
      ])
    ) as DashboardResponsiveLayouts,
    currentPageId: pages[currentPageIndex]?.id ?? pages[0].id
  };
}

export function addWidgetToDashboardDocument(
  document: DashboardLayoutDocument,
  type: DashboardWidgetType,
  maxRows: number,
  preferredPageIndex: number,
  strictBreakpoint?: DashboardBreakpoint
): DashboardLayoutDocument {
  const primaryBreakpoint = strictBreakpoint ?? "lg";
  const safeDocument = sanitizeDashboardDocument(document, maxRows, primaryBreakpoint);
  const initialPage = safeDocument.pages[Math.min(Math.max(0, preferredPageIndex), safeDocument.pages.length - 1)]?.id ?? safeDocument.pages[0].id;
  const widget = createWidget(type, initialPage);
  const occupied = buildOccupiedLayouts(safeDocument, maxRows);
  const templates = Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => [breakpoint, buildWidgetTemplate(widget, breakpoint, preferredPageIndex, undefined, maxRows)])
  ) as Record<DashboardBreakpoint, WidgetTemplate>;
  const primaryPlacement = findPrimaryPlacement(
    occupied[primaryBreakpoint],
    templates[primaryBreakpoint],
    primaryBreakpoint,
    maxRows,
    preferredPageIndex
  );
  const positions = {
    [primaryBreakpoint]: primaryPlacement
  } as Record<DashboardBreakpoint, Rect>;

  for (const breakpoint of BREAKPOINT_KEYS) {
    if (breakpoint === primaryBreakpoint) {
      continue;
    }

    positions[breakpoint] =
      findPlacementForBreakpoint(occupied[breakpoint], templates[breakpoint], breakpoint, maxRows, primaryPlacement.page, true) ??
      requestedRectForPlacement(templates[breakpoint], primaryPlacement.page);
  }

  const placement: SharedPlacement = {
    page: primaryPlacement.page,
    positions
  };
  const pages = alignPages(safeDocument.pages, Math.max(safeDocument.pages.length, primaryPlacement.page + 1));
  const pageId = pages[primaryPlacement.page]?.id ?? pages[0].id;

  return {
    ...safeDocument,
    pages,
    widgets: [...safeDocument.widgets, { ...widget, pageId }],
    layouts: mergeWidgetLayouts(safeDocument.layouts, widget, pageId, placement, maxRows),
    currentPageId: pageId
  };
}

export function moveWidgetToPageInDashboardDocument(
  document: DashboardLayoutDocument,
  widgetId: string,
  targetPageId: string,
  maxRows: number,
  strictBreakpoint?: DashboardBreakpoint
): DashboardLayoutDocument {
  const widget = document.widgets.find((candidate) => candidate.id === widgetId);
  const targetPageIndex = document.pages.findIndex((page) => page.id === targetPageId);
  const primaryBreakpoint = strictBreakpoint ?? "lg";

  if (!widget || targetPageIndex < 0) {
    return document;
  }

  const occupied = buildOccupiedLayouts(document, maxRows, widgetId);
  const templates = Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => {
      const item = widgetLayoutItem(document.layouts, breakpoint, widget.id);
      return [breakpoint, buildWidgetTemplate(widget, breakpoint, targetPageIndex, item, maxRows)];
    })
  ) as Record<DashboardBreakpoint, WidgetTemplate>;
  const primaryPlacement = findPlacementForBreakpoint(
    occupied[primaryBreakpoint],
    templates[primaryBreakpoint],
    primaryBreakpoint,
    maxRows,
    targetPageIndex,
    true
  );

  if (!primaryPlacement) {
    return document;
  }

  const positions = {
    [primaryBreakpoint]: primaryPlacement
  } as Record<DashboardBreakpoint, Rect>;

  for (const breakpoint of BREAKPOINT_KEYS) {
    if (breakpoint === primaryBreakpoint) {
      continue;
    }

    positions[breakpoint] =
      findPlacementForBreakpoint(occupied[breakpoint], templates[breakpoint], breakpoint, maxRows, targetPageIndex, true) ??
      requestedRectForPlacement(templates[breakpoint], targetPageIndex);
  }

  const placement: SharedPlacement = {
    page: targetPageIndex,
    positions
  };

  return {
    ...document,
    widgets: document.widgets.map((candidate) =>
      candidate.id === widgetId ? { ...candidate, pageId: targetPageId } : candidate
    ),
    layouts: mergeWidgetLayouts(document.layouts, widget, targetPageId, placement, maxRows),
    currentPageId: targetPageId
  };
}

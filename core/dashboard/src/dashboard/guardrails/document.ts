import { BREAKPOINT_KEYS, COLS } from "../constants";
import type { DashboardBreakpoint, DashboardLayoutDocument, DashboardLayoutItem, DashboardWidget } from "../../types";
import type { WidgetSizing } from "../types";
import { coerceWidgetSizing } from "./sizing";
import { fitsWithinBounds, findPlacementForSizedWidget, validateDashboardGeometry } from "./geometry";
import { validateDashboardStructure } from "./structure";
import type {
  DashboardGuardrailReport,
  DashboardSanitizeContext,
  DashboardSizedLayoutItemContext,
  DashboardWidgetSortContext
} from "./types";

function buildSizedLayoutItem(context: DashboardSizedLayoutItemContext): DashboardLayoutItem {
  const { widget, pageId, breakpoint, size, position } = context;

  return {
    i: widget.id,
    pageId,
    x: position.x,
    y: position.y,
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

function createResponsiveLayoutBucket() {
  return Object.fromEntries(BREAKPOINT_KEYS.map((breakpoint) => [breakpoint, []])) as unknown as DashboardLayoutDocument["layouts"];
}

function widgetSortKey(widget: DashboardWidget, context: DashboardWidgetSortContext): [number, number, number, string] {
  const pageIndex = context.pageOrder.get(widget.pageId) ?? Number.MAX_SAFE_INTEGER;
  const position = context.layoutOrder.get(widget.id);
  return [pageIndex, position?.y ?? Number.MAX_SAFE_INTEGER, position?.x ?? Number.MAX_SAFE_INTEGER, widget.id];
}

function compareSortKeys(left: [number, number, number, string], right: [number, number, number, string]) {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2] || left[3].localeCompare(right[3]);
}

export function inspectDashboardGuardrails(
  document: DashboardLayoutDocument,
  maxRows: number,
  strictBreakpoint?: DashboardBreakpoint
): DashboardGuardrailReport {
  return {
    structureViolations: validateDashboardStructure({ document }),
    geometryViolations: validateDashboardGeometry({ document, maxRows, strictBreakpoint })
  };
}

export function sanitizeDashboardDocument(context: DashboardSanitizeContext): DashboardLayoutDocument {
  const { document, maxRows, createPage, ensureWidgetsHaveLayouts, renumberPages, strictBreakpoint } = context;
  const source = ensureWidgetsHaveLayouts(document);
  const normalizedPages = renumberPages(
    source.pages.map((page) => ({
      ...page,
      isDraft: false
    }))
  );
  const pageOrder = new Map(normalizedPages.map((page, index) => [page.id, index]));
  const layoutOrderBreakpoint = strictBreakpoint ?? "lg";
  const lgOrder = new Map(
    source.layouts[layoutOrderBreakpoint].map((item) => [
      item.i,
      {
        y: item.y,
        x: item.x
      }
    ])
  );

  const widgets = [...source.widgets].sort((left, right) =>
    compareSortKeys(widgetSortKey(left, { pageOrder, layoutOrder: lgOrder }), widgetSortKey(right, { pageOrder, layoutOrder: lgOrder }))
  );

  const nextLayouts = createResponsiveLayoutBucket();
  let nextPages = [...normalizedPages];

  const nextWidgets = widgets.map((widget) => {
    const sizes = Object.fromEntries(
      BREAKPOINT_KEYS.map((breakpoint) => {
        const existing = source.layouts[breakpoint].find((item) => item.i === widget.id);
        return [breakpoint, coerceWidgetSizing(widget.type, breakpoint, existing, maxRows)];
      })
    ) as Record<DashboardBreakpoint, WidgetSizing>;

    let searchIndex = Math.max(0, pageOrder.get(widget.pageId) ?? 0);
    let placement: Record<DashboardBreakpoint, { x: number; y: number }> | null = null;
    let targetPageId = nextPages[searchIndex]?.id ?? nextPages[0]?.id;

    while (!placement) {
      if (!targetPageId) {
        const created = createPage(nextPages.length);
        nextPages = renumberPages([...nextPages, created]);
        targetPageId = nextPages.at(-1)?.id ?? created.id;
      }

      placement = findPlacementForSizedWidget({
        layouts: nextLayouts,
        pageId: targetPageId,
        sizes,
        maxRows,
        strictBreakpoint
      });

      if (placement) {
        break;
      }

      searchIndex += 1;
      if (searchIndex >= nextPages.length) {
        nextPages = renumberPages([...nextPages, createPage(nextPages.length)]);
      }
      targetPageId = nextPages[searchIndex]?.id ?? null;
    }

    for (const breakpoint of BREAKPOINT_KEYS) {
      nextLayouts[breakpoint].push(
        buildSizedLayoutItem({
          widget,
          pageId: targetPageId,
          breakpoint,
          size: sizes[breakpoint],
          position: placement[breakpoint]
        })
      );
    }

    return {
      ...widget,
      pageId: targetPageId
    };
  });

  const usedPageIds = new Set(nextWidgets.map((widget) => widget.pageId));
  const pages = renumberPages(nextPages.filter((page) => usedPageIds.has(page.id)));
  const validPageIds = new Set(pages.map((page) => page.id));

  if (pages.length === 0) {
    const fallbackPage = createPage(0);
    return {
      ...source,
      pages: renumberPages([fallbackPage]),
      widgets: [],
      layouts: createResponsiveLayoutBucket(),
      currentPageId: fallbackPage.id
    };
  }

  return {
    ...source,
    pages,
    widgets: nextWidgets.filter((widget) => validPageIds.has(widget.pageId)),
    layouts: Object.fromEntries(
      BREAKPOINT_KEYS.map((breakpoint) => [
        breakpoint,
        nextLayouts[breakpoint].filter(
          (item) =>
            validPageIds.has(item.pageId) &&
            item.x >= 0 &&
            item.y >= 0 &&
            item.x + item.w <= COLS[breakpoint] &&
            (strictBreakpoint ? true : fitsWithinBounds(item, breakpoint, maxRows))
        )
      ])
    ) as DashboardLayoutDocument["layouts"],
    currentPageId: validPageIds.has(source.currentPageId) ? source.currentPageId : pages[0].id
  };
}

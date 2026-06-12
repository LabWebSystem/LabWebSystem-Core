import type { DashboardBreakpoint, DashboardLayoutItem, DashboardResponsiveLayouts, DashboardWidgetType } from "../../types";
import { BREAKPOINT_KEYS, COLS } from "../constants";
import type { WidgetSizing } from "../types";
import { widgetSizing } from "../widgetDefinitions";
import type {
  DashboardGeometryValidationContext,
  DashboardLayoutItemLike,
  DashboardPlacement,
  DashboardSizedPlacementContext,
  DashboardPlacementContext,
  DashboardGeometryViolation
} from "./types";

export function intersects(left: DashboardLayoutItemLike, right: DashboardLayoutItemLike): boolean {
  return left.x < right.x + right.w && left.x + left.w > right.x && left.y < right.y + right.h && left.y + left.h > right.y;
}

export function fitsWithinBounds(item: DashboardLayoutItemLike, breakpoint: DashboardBreakpoint, maxRows: number): boolean {
  return item.x >= 0 && item.y >= 0 && item.x + item.w <= COLS[breakpoint] && item.y + item.h <= maxRows;
}

export function findAvailablePosition(
  items: DashboardLayoutItemLike[],
  breakpoint: DashboardBreakpoint,
  size: WidgetSizing,
  maxRows: number
): { x: number; y: number } | null {
  const cols = COLS[breakpoint];
  const maxX = cols - size.w;
  const maxY = maxRows - size.h;

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const candidate = { x, y, w: size.w, h: size.h };
      if (!items.some((item) => intersects(candidate, item))) {
        return { x, y };
      }
    }
  }

  return null;
}

function findBestEffortPosition(
  items: DashboardLayoutItemLike[],
  breakpoint: DashboardBreakpoint,
  size: WidgetSizing,
  maxRows: number
): { x: number; y: number } | null {
  return (
    findAvailablePosition(items, breakpoint, size, maxRows) ??
    findAvailablePosition(
      items,
      breakpoint,
      size,
      Math.max(
        maxRows,
        items.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0) + size.h
      )
    )
  );
}

export function findPlacementForWidget(context: DashboardPlacementContext): DashboardPlacement | null {
  const { layouts, pageId, type, maxRows, strictBreakpoint } = context;
  const placement = {} as DashboardPlacement;

  const strictBreakpoints = strictBreakpoint ? [strictBreakpoint] : BREAKPOINT_KEYS;

  for (const breakpoint of strictBreakpoints) {
    const size = widgetSizing(type, breakpoint);
    const pageItems = layouts[breakpoint].filter((item) => item.pageId === pageId);
    const position = findAvailablePosition(pageItems, breakpoint, size, maxRows);

    if (!position) {
      return null;
    }

    placement[breakpoint] = position;
  }

  for (const breakpoint of BREAKPOINT_KEYS) {
    if (placement[breakpoint]) {
      continue;
    }

    const size = widgetSizing(type, breakpoint);
    const pageItems = layouts[breakpoint].filter((item) => item.pageId === pageId);
    const position = findBestEffortPosition(pageItems, breakpoint, size, maxRows);

    if (!position) {
      return null;
    }

    placement[breakpoint] = position;
  }

  return placement;
}

export function findPlacementForSizedWidget(context: DashboardSizedPlacementContext): DashboardPlacement | null {
  const { layouts, pageId, sizes, maxRows, excludeWidgetId, strictBreakpoint } = context;
  const placement = {} as DashboardPlacement;

  const strictBreakpoints = strictBreakpoint ? [strictBreakpoint] : BREAKPOINT_KEYS;

  for (const breakpoint of strictBreakpoints) {
    const pageItems = layouts[breakpoint].filter((item) => item.pageId === pageId && item.i !== excludeWidgetId);
    const position = findAvailablePosition(pageItems, breakpoint, sizes[breakpoint], maxRows);

    if (!position) {
      return null;
    }

    placement[breakpoint] = position;
  }

  for (const breakpoint of BREAKPOINT_KEYS) {
    if (placement[breakpoint]) {
      continue;
    }

    const pageItems = layouts[breakpoint].filter((item) => item.pageId === pageId && item.i !== excludeWidgetId);
    const position = findBestEffortPosition(pageItems, breakpoint, sizes[breakpoint], maxRows);

    if (!position) {
      return null;
    }

    placement[breakpoint] = position;
  }

  return placement;
}

function collectOutOfBoundsViolations(
  item: DashboardLayoutItem,
  breakpoint: DashboardBreakpoint,
  maxRows: number
): DashboardGeometryViolation[] {
  const violations: DashboardGeometryViolation[] = [];

  if (!fitsWithinBounds(item, breakpoint, maxRows)) {
    violations.push({
      code: "out_of_bounds",
      detail: `widget ${item.i} is outside the ${breakpoint} grid bounds`,
      breakpoint,
      pageId: item.pageId,
      widgetId: item.i
    });
  }

  if (item.y + item.h > maxRows) {
    violations.push({
      code: "page_overflow",
      detail: `widget ${item.i} exceeds maxRows on ${breakpoint}`,
      breakpoint,
      pageId: item.pageId,
      widgetId: item.i
    });
  }

  return violations;
}

function collectSizeConstraintViolations(
  item: DashboardLayoutItem,
  breakpoint: DashboardBreakpoint,
  type: DashboardWidgetType
): DashboardGeometryViolation[] {
  const definition = widgetSizing(type, breakpoint);
  const minW = item.minW ?? definition.minW;
  const minH = item.minH ?? definition.minH;
  const maxW = item.maxW ?? definition.maxW ?? COLS[breakpoint];
  const maxH = item.maxH ?? definition.maxH ?? Number.MAX_SAFE_INTEGER;

  if (item.w < minW || item.h < minH || item.w > maxW || item.h > maxH) {
    return [
      {
        code: "size_constraint_mismatch",
        detail: `widget ${item.i} violates size constraints on ${breakpoint}`,
        breakpoint,
        pageId: item.pageId,
        widgetId: item.i
      }
    ];
  }

  return [];
}

function collectOverlapViolations(items: DashboardLayoutItem[], breakpoint: DashboardBreakpoint): DashboardGeometryViolation[] {
  const violations: DashboardGeometryViolation[] = [];

  for (let index = 0; index < items.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < items.length; compareIndex += 1) {
      const left = items[index];
      const right = items[compareIndex];

      if (left.pageId !== right.pageId) {
        continue;
      }

      if (!intersects(left, right)) {
        continue;
      }

      violations.push({
        code: "overlap",
        detail: `widgets ${left.i} and ${right.i} overlap on ${breakpoint}`,
        breakpoint,
        pageId: left.pageId,
        widgetId: left.i,
        relatedWidgetId: right.i
      });
    }
  }

  return violations;
}

export function validateDashboardGeometry(context: DashboardGeometryValidationContext): DashboardGeometryViolation[] {
  const { document, maxRows, strictBreakpoint } = context;
  const widgetTypeById = new Map(document.widgets.map((widget) => [widget.id, widget.type]));
  const violations: DashboardGeometryViolation[] = [];
  const breakpoints = strictBreakpoint ? [strictBreakpoint] : BREAKPOINT_KEYS;

  for (const breakpoint of breakpoints) {
    const items = document.layouts[breakpoint];
    for (const item of items) {
      const type = widgetTypeById.get(item.i);
      if (!type) {
        continue;
      }

      violations.push(...collectOutOfBoundsViolations(item, breakpoint, maxRows));
      violations.push(...collectSizeConstraintViolations(item, breakpoint, type));
    }

    violations.push(...collectOverlapViolations(items, breakpoint));
  }

  return violations;
}

import type { DashboardBreakpoint, DashboardLayoutItem, DashboardWidgetType } from "../../types";
import { BREAKPOINT_KEYS, COLS } from "../constants";
import type { WidgetSizing } from "../types";
import { widgetSizing } from "../widgetDefinitions";
import type { DashboardWidgetSizes } from "./types";

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

export function coerceWidgetSizing(
  type: DashboardWidgetType,
  breakpoint: DashboardBreakpoint,
  candidate: Partial<Pick<DashboardLayoutItem, "w" | "h" | "minW" | "minH" | "maxW" | "maxH">> | undefined,
  maxRows: number
): WidgetSizing {
  const definition = widgetSizing(type, breakpoint);
  const maxGridWidth = COLS[breakpoint];
  const minW = Math.min(maxGridWidth, Math.max(1, toPositiveInteger(candidate?.minW, definition.minW)));
  const minH = Math.max(1, toPositiveInteger(candidate?.minH, definition.minH));
  const hardMaxW = candidate?.maxW ? Math.max(minW, toPositiveInteger(candidate.maxW, definition.maxW ?? maxGridWidth)) : definition.maxW;
  const hardMaxH = candidate?.maxH ? Math.max(minH, toPositiveInteger(candidate.maxH, definition.maxH ?? maxRows)) : definition.maxH;
  const maxW = Math.min(maxGridWidth, hardMaxW ?? maxGridWidth);
  const maxH = Math.min(maxRows, hardMaxH ?? maxRows);
  const w = Math.min(maxW, Math.max(minW, toPositiveInteger(candidate?.w, definition.w)));
  const h = Math.min(maxH, Math.max(minH, toPositiveInteger(candidate?.h, definition.h)));

  return {
    w,
    h,
    minW,
    minH,
    maxW,
    maxH
  };
}

export function widgetSizesForDocument(
  layouts: Record<DashboardBreakpoint, DashboardLayoutItem[]>,
  widgetId: string,
  widgetType: DashboardWidgetType,
  maxRows: number
): DashboardWidgetSizes {
  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => {
      const existing = layouts[breakpoint].find((item) => item.i === widgetId);
      const fallback = widgetSizing(widgetType, breakpoint);
      const minW = existing?.minW ?? fallback.minW;
      const minH = existing?.minH ?? fallback.minH;
      const maxW = Math.min(existing?.maxW ?? fallback.maxW ?? COLS[breakpoint], fallback.maxW ?? COLS[breakpoint], COLS[breakpoint]);
      const maxH = Math.min(existing?.maxH ?? fallback.maxH ?? maxRows, fallback.maxH ?? maxRows, maxRows);

      return [
        breakpoint,
        {
          w: Math.min(maxW, Math.max(minW, existing?.w ?? fallback.w)),
          h: Math.min(maxH, Math.max(minH, existing?.h ?? fallback.h)),
          minW,
          minH,
          maxW,
          maxH
        }
      ];
    })
  ) as DashboardWidgetSizes;
}

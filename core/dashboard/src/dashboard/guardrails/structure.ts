import { BREAKPOINT_KEYS } from "../constants";
import type { DashboardStructureValidationContext, DashboardStructureViolation } from "./types";

export function validateDashboardStructure(context: DashboardStructureValidationContext): DashboardStructureViolation[] {
  const { document } = context;
  const violations: DashboardStructureViolation[] = [];

  const pageIds = new Set<string>();
  for (const page of document.pages) {
    if (pageIds.has(page.id)) {
      violations.push({
        code: "duplicate_page_id",
        detail: `page ${page.id} appears multiple times`,
        pageId: page.id
      });
      continue;
    }
    pageIds.add(page.id);
  }

  const widgetIds = new Set<string>();
  for (const widget of document.widgets) {
    if (widgetIds.has(widget.id)) {
      violations.push({
        code: "duplicate_widget_id",
        detail: `widget ${widget.id} appears multiple times`,
        widgetId: widget.id,
        pageId: widget.pageId
      });
    } else {
      widgetIds.add(widget.id);
    }

    if (!pageIds.has(widget.pageId)) {
      violations.push({
        code: "widget_without_page",
        detail: `widget ${widget.id} points to unknown page ${widget.pageId}`,
        widgetId: widget.id,
        pageId: widget.pageId
      });
    }
  }

  for (const breakpoint of BREAKPOINT_KEYS) {
    const layoutKeys = new Set<string>();
    for (const item of document.layouts[breakpoint]) {
      const uniqueKey = `${item.pageId}:${item.i}`;

      if (!widgetIds.has(item.i)) {
        violations.push({
          code: "layout_without_widget",
          detail: `layout item ${item.i} on ${breakpoint} has no matching widget`,
          widgetId: item.i,
          pageId: item.pageId,
          breakpoint
        });
      }

      if (!pageIds.has(item.pageId)) {
        violations.push({
          code: "layout_without_page",
          detail: `layout item ${item.i} on ${breakpoint} points to missing page ${item.pageId}`,
          widgetId: item.i,
          pageId: item.pageId,
          breakpoint
        });
      }

      if (layoutKeys.has(uniqueKey)) {
        violations.push({
          code: "duplicate_layout_item",
          detail: `layout item ${item.i} is duplicated on ${breakpoint} for page ${item.pageId}`,
          widgetId: item.i,
          pageId: item.pageId,
          breakpoint
        });
        continue;
      }

      layoutKeys.add(uniqueKey);
    }
  }

  return violations;
}

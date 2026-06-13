import { invariant } from "./assert";
import type { LayoutState, PageIndex, WidgetLayout } from "./types";

export function calculatePageCount(widgets: readonly WidgetLayout[]): number {
  if (widgets.length === 0) return 1;
  return Math.max(1, Math.max(...widgets.map((widget) => widget.page)) + 1);
}

export function compressWidgetPages(widgets: readonly WidgetLayout[]): readonly WidgetLayout[] {
  if (widgets.length === 0) return [];
  const usedPages = [...new Set(widgets.map((widget) => widget.page))].sort((a, b) => a - b);
  const pageMap = new Map<PageIndex, PageIndex>(usedPages.map((page, index) => [page, index]));
  return widgets.map((widget) => {
    const page = pageMap.get(widget.page);
    invariant(page !== undefined, `page map is missing page ${widget.page}`);
    return { ...widget, page };
  });
}

export function withCompressedPages(state: LayoutState): LayoutState {
  const widgets = compressWidgetPages(state.widgets);
  return {
    ...state,
    widgets,
    pageCount: calculatePageCount(widgets),
    draftPage: null
  };
}

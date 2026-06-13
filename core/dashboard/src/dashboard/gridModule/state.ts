import { DashboardInvariantError, invariant } from "./assert";
import { assertGridConfig, assertRectInGrid, intersects } from "./geometry";
import { calculatePageCount } from "./pages";
import type { CreateLayoutStateInput, GridConfig, LayoutState, WidgetLayout } from "./types";

export function assertWidgetSizeConstraints(widget: WidgetLayout, grid: GridConfig): void {
  invariant(widget.minW > 0, `widget ${widget.id}: minW must be greater than 0`);
  invariant(widget.minH > 0, `widget ${widget.id}: minH must be greater than 0`);
  invariant(widget.maxW >= widget.minW, `widget ${widget.id}: maxW must be >= minW`);
  invariant(widget.maxH >= widget.minH, `widget ${widget.id}: maxH must be >= minH`);
  invariant(widget.w >= widget.minW, `widget ${widget.id}: w must be >= minW`);
  invariant(widget.h >= widget.minH, `widget ${widget.id}: h must be >= minH`);
  invariant(widget.w <= widget.maxW, `widget ${widget.id}: w must be <= maxW`);
  invariant(widget.h <= widget.maxH, `widget ${widget.id}: h must be <= maxH`);
  invariant(widget.w <= grid.cols, `widget ${widget.id}: w must be <= grid.cols`);
  invariant(widget.h <= grid.rows, `widget ${widget.id}: h must be <= grid.rows`);
}

export function assertNoDuplicateIds(widgets: readonly WidgetLayout[]): void {
  const ids = new Set<string>();
  for (const widget of widgets) {
    invariant(!ids.has(widget.id), `duplicate widget id: ${widget.id}`);
    ids.add(widget.id);
  }
}

export function assertNoCollisions(widgets: readonly WidgetLayout[]): void {
  for (let i = 0; i < widgets.length; i += 1) {
    const a = widgets[i];
    invariant(a !== undefined, 'unexpected missing widget');
    for (let j = i + 1; j < widgets.length; j += 1) {
      const b = widgets[j];
      invariant(b !== undefined, 'unexpected missing widget');
      invariant(!intersects(a, b), `widgets collide: ${a.id} and ${b.id}`);
    }
  }
}

export function assertContinuousPages(state: LayoutState): void {
  invariant(state.pageCount >= 1, 'pageCount must be greater than or equal to 1');
  for (const widget of state.widgets) {
    invariant(widget.page >= 0, `widget ${widget.id}: page must be >= 0`);
    invariant(widget.page < state.pageCount, `widget ${widget.id}: page must be < pageCount`);
  }

  const usedPages = new Set(state.widgets.map((widget) => widget.page));
  for (let page = 0; page < state.pageCount; page += 1) {
    if (state.widgets.length > 0) {
      invariant(usedPages.has(page), `empty page must not remain: page ${page}`);
    }
  }
}

export function assertLayoutState(state: LayoutState): void {
  assertGridConfig(state.grid);
  assertNoDuplicateIds(state.widgets);

  for (const widget of state.widgets) {
    assertRectInGrid(widget, state.grid);
    assertWidgetSizeConstraints(widget, state.grid);
  }

  assertNoCollisions(state.widgets);
  assertContinuousPages(state);

  if (state.draftPage !== null) {
    invariant(state.draftPage.page === state.pageCount, 'draftPage may exist only after the last real page');
  }
}

export function createLayoutState(input: CreateLayoutStateInput): LayoutState {
  const state: LayoutState = {
    grid: input.grid,
    mode: input.mode ?? 'edit',
    collisionMode: input.collisionMode ?? 'reject',
    widgets: input.widgets ?? [],
    pageCount: calculatePageCount(input.widgets ?? []),
    draftPage: input.draftPage ?? null
  };

  assertLayoutState(state);
  return state;
}

export function safeAssertLayoutState(state: LayoutState): DashboardInvariantError | null {
  try {
    assertLayoutState(state);
    return null;
  } catch (error) {
    if (error instanceof DashboardInvariantError) return error;
    throw error;
  }
}

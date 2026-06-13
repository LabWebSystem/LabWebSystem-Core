import { operationGuard } from "./assert";
import { findFreeSpace, isRectFree, resolvePlacement } from "./collision";
import { assertRectInGrid, rectEquals, sortRectsByReadingOrder } from "./geometry";
import { calculatePageCount, compressWidgetPages, withCompressedPages } from "./pages";
import { assertLayoutState, createLayoutState } from "./state";
import type {
  CollisionMode,
  Direction,
  LayoutState,
  PlacementResult,
  Rect,
  WidgetId,
  WidgetLayout,
  WidgetTemplate
} from "./types";

function toWidgetLayout(template: WidgetTemplate, rect: Rect): WidgetLayout {
  return {
    id: template.id,
    type: template.type,
    page: rect.page,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    minW: template.minW,
    minH: template.minH,
    maxW: template.maxW,
    maxH: template.maxH,
    ...(template.locked !== undefined ? { locked: template.locked } : {}),
    ...(template.draggable !== undefined ? { draggable: template.draggable } : {}),
    ...(template.resizable !== undefined ? { resizable: template.resizable } : {})
  };
}

function findWidgetOrThrow(widgets: readonly WidgetLayout[], id: WidgetId): WidgetLayout {
  const widget = widgets.find((item) => item.id === id);
  operationGuard(widget !== undefined, `widget not found: ${id}`);
  return widget;
}

function rejectResult(state: LayoutState, target: Rect, reason: string): PlacementResult {
  return {
    status: 'rejected',
    state,
    placeholder: { ...target, valid: false, reason },
    plan: null,
    reason
  };
}

function acceptedStateFromWidgets(state: LayoutState, widgets: readonly WidgetLayout[]): LayoutState {
  const compressedWidgets = compressWidgetPages(widgets);
  const next: LayoutState = {
    ...state,
    widgets: sortRectsByReadingOrder(compressedWidgets),
    pageCount: calculatePageCount(compressedWidgets),
    draftPage: null
  };
  assertLayoutState(next);
  return next;
}

export class GridDashboardEngine {
  public readonly state: LayoutState;

  public constructor(state: LayoutState) {
    assertLayoutState(state);
    this.state = state;
  }

  public static create(input: Parameters<typeof createLayoutState>[0]): GridDashboardEngine {
    return new GridDashboardEngine(createLayoutState(input));
  }

  public setMode(mode: LayoutState['mode']): GridDashboardEngine {
    return new GridDashboardEngine({ ...this.state, mode });
  }

  public setCollisionMode(collisionMode: CollisionMode): GridDashboardEngine {
    return new GridDashboardEngine({ ...this.state, collisionMode });
  }

  public addWidget(template: WidgetTemplate): LayoutState {
    operationGuard(this.state.mode === 'edit', 'addWidget requires edit mode');
    operationGuard(!this.state.widgets.some((widget) => widget.id === template.id), `duplicate widget id: ${template.id}`);

    const requestedW = template.w ?? template.minW;
    const requestedH = template.h ?? template.minH;
    operationGuard(requestedW >= template.minW && requestedW <= template.maxW, 'template width violates size constraints');
    operationGuard(requestedH >= template.minH && requestedH <= template.maxH, 'template height violates size constraints');

    const preferredPage = template.page ?? 0;
    const preferredRect: Rect = {
      page: preferredPage,
      x: template.x ?? 0,
      y: template.y ?? 0,
      w: requestedW,
      h: requestedH
    };

    let rect: Rect | null = null;
    try {
      assertRectInGrid(preferredRect, this.state.grid);
      if (isRectFree(this.state.widgets, preferredRect, this.state.grid)) {
        rect = preferredRect;
      }
    } catch {
      rect = null;
    }

    if (rect === null) {
      for (let page = 0; page < this.state.pageCount; page += 1) {
        const free = findFreeSpace({
          widgets: this.state.widgets,
          grid: this.state.grid,
          page,
          size: { w: requestedW, h: requestedH }
        });
        if (free !== null) {
          rect = free;
          break;
        }
      }
    }

    if (rect === null) {
      rect = { page: this.state.pageCount, x: 0, y: 0, w: requestedW, h: requestedH };
    }

    const widget = toWidgetLayout(template, rect);
    const nextWidgets = sortRectsByReadingOrder([...this.state.widgets, widget]);
    const next = createLayoutState({
      grid: this.state.grid,
      widgets: nextWidgets,
      mode: this.state.mode,
      collisionMode: this.state.collisionMode
    });
    assertLayoutState(next);
    return next;
  }

  public removeWidget(widgetId: WidgetId): LayoutState {
    operationGuard(this.state.mode === 'edit', 'removeWidget requires edit mode');
    operationGuard(this.state.widgets.some((widget) => widget.id === widgetId), `widget not found: ${widgetId}`);
    const widgets = this.state.widgets.filter((widget) => widget.id !== widgetId);
    const next = withCompressedPages({ ...this.state, widgets });
    assertLayoutState(next);
    return next;
  }

  public moveWidget(widgetId: WidgetId, to: Rect, directionHint?: Direction): PlacementResult {
    operationGuard(this.state.mode === 'edit', 'moveWidget requires edit mode');
    const widget = findWidgetOrThrow(this.state.widgets, widgetId);
    operationGuard(widget.locked !== true, `widget is locked: ${widgetId}`);
    operationGuard(widget.draggable !== false, `widget is not draggable: ${widgetId}`);

    if (rectEquals(widget, to)) {
      return {
        status: 'accepted',
        state: this.state,
        placeholder: { ...to, valid: true },
        plan: null
      };
    }

    const result = resolvePlacement({
      widgets: this.state.widgets,
      movingId: widgetId,
      target: to,
      grid: this.state.grid,
      collisionMode: this.state.collisionMode,
      ...(directionHint !== undefined ? { directionHint } : {})
    });

    if (!result.accepted) {
      return rejectResult(this.state, to, result.reason ?? 'placement rejected');
    }

    const state = acceptedStateFromWidgets(this.state, result.widgets);
    return {
      status: 'accepted',
      state,
      placeholder: { ...to, valid: true },
      plan: result.plan
    };
  }

  public resizeWidget(widgetId: WidgetId, size: { readonly w: number; readonly h: number }, directionHint?: Direction): PlacementResult {
    operationGuard(this.state.mode === 'edit', 'resizeWidget requires edit mode');
    const widget = findWidgetOrThrow(this.state.widgets, widgetId);
    operationGuard(widget.locked !== true, `widget is locked: ${widgetId}`);
    operationGuard(widget.resizable !== false, `widget is not resizable: ${widgetId}`);

    const target: Rect = { page: widget.page, x: widget.x, y: widget.y, w: size.w, h: size.h };
    return this.moveWidget(widgetId, target, directionHint);
  }

  public validatePlacement(widgetId: WidgetId, rect: Rect, collisionMode = this.state.collisionMode): boolean {
    const result = resolvePlacement({
      widgets: this.state.widgets,
      movingId: widgetId,
      target: rect,
      grid: this.state.grid,
      collisionMode
    });
    return result.accepted;
  }

  public findFreeSpace(size: { readonly w: number; readonly h: number }, page = 0): Rect | null {
    return findFreeSpace({ widgets: this.state.widgets, grid: this.state.grid, page, size });
  }

  public compressPages(): LayoutState {
    const next = withCompressedPages(this.state);
    assertLayoutState(next);
    return next;
  }
}

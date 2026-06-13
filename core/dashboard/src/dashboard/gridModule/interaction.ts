import { invariant, operationGuard } from "./assert";
import { pointerToCandidateRect, rectToPixels } from "./geometry";
import type {
  DashboardViewport,
  DragSession,
  DragUpdateInput,
  DragUpdateResult,
  LayoutState,
  PageSwitchPolicy,
  PixelRect,
  Point,
  PointerInput,
  Rect,
  WidgetId,
  WidgetLayout
} from "./types";

export const defaultPageSwitchPolicy: PageSwitchPolicy = {
  outsideThresholdPx: 22,
  cooldownMs: 240,
  axis: 'horizontal'
};

function findWidgetOrThrow(state: LayoutState, widgetId: WidgetId): WidgetLayout {
  const widget = state.widgets.find((item) => item.id === widgetId);
  operationGuard(widget !== undefined, `widget not found: ${widgetId}`);
  return widget;
}

export function createDragSession(args: {
  readonly state: LayoutState;
  readonly widgetId: WidgetId;
  readonly pointer: PointerInput;
  readonly metrics: Parameters<typeof rectToPixels>[1];
}): DragSession {
  operationGuard(args.state.mode === 'edit', 'drag requires edit mode');
  const widget = findWidgetOrThrow(args.state, args.widgetId);
  operationGuard(widget.locked !== true, `widget is locked: ${widget.id}`);
  operationGuard(widget.draggable !== false, `widget is not draggable: ${widget.id}`);

  const rectPx = rectToPixels(widget, args.metrics);
  const grabOffsetPx: Point = {
    x: args.pointer.clientX - rectPx.left,
    y: args.pointer.clientY - rectPx.top
  };

  const clampedOffset: Point = {
    x: Math.max(0, Math.min(grabOffsetPx.x, rectPx.width)),
    y: Math.max(0, Math.min(grabOffsetPx.y, rectPx.height))
  };

  return {
    widgetId: args.widgetId,
    sourceRect: widget,
    grabOffsetPx: clampedOffset,
    currentPage: widget.page,
    candidateRect: widget,
    startedAtMs: args.pointer.timeMs ?? Date.now(),
    lastPageSwitchAtMs: null
  };
}

function mergePolicy(policy?: Partial<PageSwitchPolicy>): PageSwitchPolicy {
  return { ...defaultPageSwitchPolicy, ...policy };
}

function canSwitchPage(session: DragSession, timeMs: number, policy: PageSwitchPolicy): boolean {
  if (session.lastPageSwitchAtMs === null) return true;
  return timeMs - session.lastPageSwitchAtMs >= policy.cooldownMs;
}

function resolvePageSwitch(args: {
  readonly session: DragSession;
  readonly pointer: PointerInput;
  readonly viewport: DashboardViewport;
  readonly policy: PageSwitchPolicy;
  readonly pageCount: number;
}): { readonly page: number; readonly switchKind: DragUpdateResult['pageSwitch']; readonly switchedAt: number | null } {
  const timeMs = args.pointer.timeMs ?? Date.now();
  if (!canSwitchPage(args.session, timeMs, args.policy)) {
    return { page: args.session.currentPage, switchKind: 'none', switchedAt: args.session.lastPageSwitchAtMs };
  }

  const rightLimit = args.viewport.left + args.viewport.width + args.policy.outsideThresholdPx;
  const leftLimit = args.viewport.left - args.policy.outsideThresholdPx;
  const bottomLimit = args.viewport.top + args.viewport.height + args.policy.outsideThresholdPx;
  const topLimit = args.viewport.top - args.policy.outsideThresholdPx;

  if (args.policy.axis === 'horizontal') {
    if (args.pointer.clientX > rightLimit) {
      const next = args.session.currentPage + 1;
      const switchKind = next >= args.pageCount ? 'draft-next' : 'next';
      return { page: next, switchKind, switchedAt: timeMs };
    }
    if (args.pointer.clientX < leftLimit && args.session.currentPage > 0) {
      return { page: args.session.currentPage - 1, switchKind: 'previous', switchedAt: timeMs };
    }
    return { page: args.session.currentPage, switchKind: 'none', switchedAt: args.session.lastPageSwitchAtMs };
  }

  if (args.pointer.clientY > bottomLimit) {
    const next = args.session.currentPage + 1;
    const switchKind = next >= args.pageCount ? 'draft-next' : 'next';
    return { page: next, switchKind, switchedAt: timeMs };
  }
  if (args.pointer.clientY < topLimit && args.session.currentPage > 0) {
    return { page: args.session.currentPage - 1, switchKind: 'previous', switchedAt: timeMs };
  }
  return { page: args.session.currentPage, switchKind: 'none', switchedAt: args.session.lastPageSwitchAtMs };
}

export function updateDragSession(args: {
  readonly state: LayoutState;
  readonly session: DragSession;
} & DragUpdateInput): DragUpdateResult {
  const widget = findWidgetOrThrow(args.state, args.session.widgetId);
  const policy = mergePolicy(args.policy);
  invariant(policy.outsideThresholdPx >= 0, 'outsideThresholdPx must be greater than or equal to 0');
  invariant(policy.cooldownMs >= 0, 'cooldownMs must be greater than or equal to 0');

  const pageSwitch = resolvePageSwitch({
    session: args.session,
    pointer: args.pointer,
    viewport: args.dashboardViewport,
    policy,
    pageCount: args.state.pageCount
  });

  const draftPage = pageSwitch.page >= args.state.pageCount ? { page: args.state.pageCount, source: 'drag' as const } : null;
  const page = Math.min(pageSwitch.page, args.state.pageCount);

  const candidateRect = pointerToCandidateRect({
    pointerClient: { x: args.pointer.clientX, y: args.pointer.clientY },
    grabOffsetPx: args.session.grabOffsetPx,
    size: { w: widget.w, h: widget.h },
    page,
    grid: args.state.grid,
    metrics: args.metrics
  });

  const nextSession: DragSession = {
    ...args.session,
    currentPage: page,
    candidateRect,
    lastPageSwitchAtMs: pageSwitch.switchedAt
  };

  return {
    session: nextSession,
    candidateRect,
    ghostRectPx: rectToPixels(candidateRect, args.metrics),
    draftPage,
    pageSwitch: pageSwitch.switchKind
  };
}

export function ghostRectMustUseCandidateRect(candidateRect: Rect, metrics: Parameters<typeof rectToPixels>[1]): PixelRect {
  return rectToPixels(candidateRect, metrics);
}

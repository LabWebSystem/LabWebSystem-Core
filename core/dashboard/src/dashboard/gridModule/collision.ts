import { assertNever, invariant } from "./assert";
import { assertRectInGrid, intersects, rectSignature, sortRectsByReadingOrder } from "./geometry";
import type {
  CollisionMode,
  Direction,
  DisplacementPlan,
  DisplacementStep,
  GridConfig,
  Rect,
  WidgetId,
  WidgetLayout
} from "./types";

export interface CollisionResolveResult {
  readonly accepted: boolean;
  readonly widgets: readonly WidgetLayout[];
  readonly plan: DisplacementPlan | null;
  readonly reason?: string;
}

function sameId(a: WidgetId, b: WidgetId): boolean {
  return a === b;
}

export function replaceWidget(widgets: readonly WidgetLayout[], updated: WidgetLayout): readonly WidgetLayout[] {
  return widgets.map((widget) => (sameId(widget.id, updated.id) ? updated : widget));
}

export function findWidget(widgets: readonly WidgetLayout[], id: WidgetId): WidgetLayout | null {
  return widgets.find((widget) => widget.id === id) ?? null;
}

export function findCollisions(
  widgets: readonly WidgetLayout[],
  rect: Rect,
  exceptIds: readonly WidgetId[] = []
): readonly WidgetLayout[] {
  const except = new Set(exceptIds);
  return widgets.filter((widget) => !except.has(widget.id) && intersects(widget, rect));
}

export function isRectFree(
  widgets: readonly WidgetLayout[],
  rect: Rect,
  grid: GridConfig,
  exceptIds: readonly WidgetId[] = []
): boolean {
  try {
    assertRectInGrid(rect, grid);
  } catch {
    return false;
  }
  return findCollisions(widgets, rect, exceptIds).length === 0;
}

export function findFreeSpace(args: {
  readonly widgets: readonly WidgetLayout[];
  readonly grid: GridConfig;
  readonly page: number;
  readonly size: Pick<Rect, 'w' | 'h'>;
  readonly exceptIds?: readonly WidgetId[];
}): Rect | null {
  for (let y = 0; y <= args.grid.rows - args.size.h; y += 1) {
    for (let x = 0; x <= args.grid.cols - args.size.w; x += 1) {
      const candidate: Rect = { page: args.page, x, y, w: args.size.w, h: args.size.h };
      if (isRectFree(args.widgets, candidate, args.grid, args.exceptIds ?? [])) {
        return candidate;
      }
    }
  }
  return null;
}

function toWidget(widget: WidgetLayout, rect: Rect): WidgetLayout {
  return { ...widget, page: rect.page, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

function planSignature(mode: CollisionMode, steps: readonly DisplacementStep[]): string {
  return [mode, ...steps.map((step) => `${step.id}:${rectSignature(step.from)}>${rectSignature(step.to)}:${step.reason}`)].join('|');
}

function rejectPlacement(args: {
  readonly widgets: readonly WidgetLayout[];
  readonly moving: WidgetLayout;
  readonly target: Rect;
  readonly grid: GridConfig;
}): CollisionResolveResult {
  const updated = toWidget(args.moving, args.target);
  if (!isRectFree(args.widgets, args.target, args.grid, [args.moving.id])) {
    return { accepted: false, widgets: args.widgets, plan: null, reason: 'target collides with existing widget' };
  }
  const widgets = replaceWidget(args.widgets, updated);
  const steps: DisplacementStep[] = [
    { id: args.moving.id, from: args.moving, to: args.target, reason: 'moving-widget' }
  ];
  return {
    accepted: true,
    widgets,
    plan: { mode: 'reject', steps, signature: planSignature('reject', steps) }
  };
}

function makeRoomFree(args: {
  readonly widgets: readonly WidgetLayout[];
  readonly moving: WidgetLayout;
  readonly target: Rect;
  readonly grid: GridConfig;
}): CollisionResolveResult {
  const blockers = sortRectsByReadingOrder(findCollisions(args.widgets, args.target, [args.moving.id]));
  const steps: DisplacementStep[] = [
    { id: args.moving.id, from: args.moving, to: args.target, reason: 'moving-widget' }
  ];

  let working = replaceWidget(args.widgets, toWidget(args.moving, args.target));
  const displacedIds: WidgetId[] = [];

  for (const blocker of blockers) {
    const blockerWithoutCurrent = working.filter((widget) => widget.id !== blocker.id);
    const free = findFreeSpace({
      widgets: blockerWithoutCurrent,
      grid: args.grid,
      page: args.target.page,
      size: { w: blocker.w, h: blocker.h },
      exceptIds: displacedIds
    });

    if (free === null) {
      return { accepted: false, widgets: args.widgets, plan: null, reason: `no free space for ${blocker.id}` };
    }

    const updatedBlocker = toWidget(blocker, free);
    working = replaceWidget(working, updatedBlocker);
    displacedIds.push(blocker.id);
    steps.push({ id: blocker.id, from: blocker, to: free, reason: 'free-space' });
  }

  return {
    accepted: true,
    widgets: working,
    plan: { mode: 'make-room-free', steps, signature: planSignature('make-room-free', steps) }
  };
}

function directionVector(direction: Direction): { readonly dx: number; readonly dy: number } {
  switch (direction) {
    case 'right':
      return { dx: 1, dy: 0 };
    case 'up':
      return { dx: 0, dy: -1 };
    case 'left':
      return { dx: -1, dy: 0 };
    case 'down':
      return { dx: 0, dy: 1 };
    default:
      return assertNever(direction);
  }
}

function counterClockwiseOrder(primary: Direction): readonly Direction[] {
  const order: readonly Direction[] = ['right', 'up', 'left', 'down'];
  const start = order.indexOf(primary);
  invariant(start >= 0, `unknown direction ${primary}`);
  return [order[start]!, order[(start + 1) % 4]!, order[(start + 2) % 4]!, order[(start + 3) % 4]!];
}

export function directionCandidates(source: Rect, target: Rect, hint?: Direction): readonly Direction[] {
  if (hint !== undefined) return counterClockwiseOrder(hint);
  const dx = source.x - target.x;
  const dy = source.y - target.y;

  if (dx === 0 && dy === 0) return ['right', 'down', 'left', 'up'];

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    return counterClockwiseOrder(dx > 0 ? 'right' : 'left');
  }

  return counterClockwiseOrder(dy > 0 ? 'down' : 'up');
}

function readRectFromPlan(widget: WidgetLayout, plan: ReadonlyMap<WidgetId, Rect>): Rect {
  return plan.get(widget.id) ?? widget;
}

function plannedWidgets(widgets: readonly WidgetLayout[], plan: ReadonlyMap<WidgetId, Rect>): readonly WidgetLayout[] {
  return widgets.map((widget) => toWidget(widget, readRectFromPlan(widget, plan)));
}

function collidesWithAnyPlanned(
  widgets: readonly WidgetLayout[],
  plan: ReadonlyMap<WidgetId, Rect>,
  rect: Rect,
  exceptIds: ReadonlySet<WidgetId>
): boolean {
  for (const widget of widgets) {
    if (exceptIds.has(widget.id)) continue;
    if (intersects(readRectFromPlan(widget, plan), rect)) return true;
  }
  return false;
}

function collectBlockersForPressure(args: {
  readonly widgets: readonly WidgetLayout[];
  readonly plan: ReadonlyMap<WidgetId, Rect>;
  readonly pressureRects: readonly Rect[];
  readonly ignoreIds: ReadonlySet<WidgetId>;
}): readonly WidgetLayout[] {
  const blockers: WidgetLayout[] = [];
  for (const widget of args.widgets) {
    if (args.ignoreIds.has(widget.id)) continue;
    const currentRect = readRectFromPlan(widget, args.plan);
    if (args.pressureRects.some((pressure) => intersects(currentRect, pressure))) {
      blockers.push(widget);
    }
  }
  return sortRectsByReadingOrder(blockers);
}

function packAdjacent(args: {
  readonly blockers: readonly WidgetLayout[];
  readonly anchorRects: readonly Rect[];
  readonly direction: Direction;
}): readonly DisplacementStep[] {
  const { direction } = args;
  const steps: DisplacementStep[] = [];

  switch (direction) {
    case 'right': {
      let cursor = Math.max(...args.anchorRects.map((rect) => rect.x + rect.w));
      const blockers = [...args.blockers].sort((a, b) => a.x - b.x || a.y - b.y);
      for (const blocker of blockers) {
        const to: Rect = { page: blocker.page, x: cursor, y: blocker.y, w: blocker.w, h: blocker.h };
        steps.push({ id: blocker.id, from: blocker, to, reason: 'adjacent-push' });
        cursor += blocker.w;
      }
      return steps;
    }
    case 'left': {
      let cursor = Math.min(...args.anchorRects.map((rect) => rect.x));
      const blockers = [...args.blockers].sort((a, b) => b.x - a.x || a.y - b.y);
      for (const blocker of blockers) {
        cursor -= blocker.w;
        const to: Rect = { page: blocker.page, x: cursor, y: blocker.y, w: blocker.w, h: blocker.h };
        steps.push({ id: blocker.id, from: blocker, to, reason: 'adjacent-push' });
      }
      return steps;
    }
    case 'down': {
      let cursor = Math.max(...args.anchorRects.map((rect) => rect.y + rect.h));
      const blockers = [...args.blockers].sort((a, b) => a.y - b.y || a.x - b.x);
      for (const blocker of blockers) {
        const to: Rect = { page: blocker.page, x: blocker.x, y: cursor, w: blocker.w, h: blocker.h };
        steps.push({ id: blocker.id, from: blocker, to, reason: 'adjacent-push' });
        cursor += blocker.h;
      }
      return steps;
    }
    case 'up': {
      let cursor = Math.min(...args.anchorRects.map((rect) => rect.y));
      const blockers = [...args.blockers].sort((a, b) => b.y - a.y || a.x - b.x);
      for (const blocker of blockers) {
        cursor -= blocker.h;
        const to: Rect = { page: blocker.page, x: blocker.x, y: cursor, w: blocker.w, h: blocker.h };
        steps.push({ id: blocker.id, from: blocker, to, reason: 'adjacent-push' });
      }
      return steps;
    }
    default:
      return assertNever(direction);
  }
}

function attemptAdjacentDirection(args: {
  readonly widgets: readonly WidgetLayout[];
  readonly moving: WidgetLayout;
  readonly target: Rect;
  readonly grid: GridConfig;
  readonly direction: Direction;
}): CollisionResolveResult {
  const plan = new Map<WidgetId, Rect>();
  plan.set(args.moving.id, args.target);

  const steps: DisplacementStep[] = [
    { id: args.moving.id, from: args.moving, to: args.target, reason: 'moving-widget' }
  ];

  const displacedIds = new Set<WidgetId>([args.moving.id]);
  let pressureRects: readonly Rect[] = [args.target];

  for (let guard = 0; guard < args.widgets.length + 1; guard += 1) {
    const blockers = collectBlockersForPressure({
      widgets: args.widgets,
      plan,
      pressureRects,
      ignoreIds: displacedIds
    });

    if (blockers.length === 0) {
      const candidateWidgets = plannedWidgets(args.widgets, plan);
      const exceptIds = new Set<WidgetId>();
      for (let i = 0; i < candidateWidgets.length; i += 1) {
        const a = candidateWidgets[i];
        invariant(a !== undefined, 'unexpected missing widget');
        try {
          assertRectInGrid(a, args.grid);
        } catch {
          return { accepted: false, widgets: args.widgets, plan: null, reason: `adjacent path overflowed ${args.direction}` };
        }
        for (let j = i + 1; j < candidateWidgets.length; j += 1) {
          const b = candidateWidgets[j];
          invariant(b !== undefined, 'unexpected missing widget');
          if (intersects(a, b)) {
            return { accepted: false, widgets: args.widgets, plan: null, reason: `adjacent plan still collides ${a.id}/${b.id}` };
          }
        }
        exceptIds.add(a.id);
      }
      return {
        accepted: true,
        widgets: candidateWidgets,
        plan: { mode: 'make-room-adjacent', steps, signature: planSignature('make-room-adjacent', steps) }
      };
    }

    const packedSteps = packAdjacent({ blockers, anchorRects: pressureRects, direction: args.direction });
    const newPressureRects: Rect[] = [];
    for (const step of packedSteps) {
      try {
        assertRectInGrid(step.to, args.grid);
      } catch {
        return { accepted: false, widgets: args.widgets, plan: null, reason: `adjacent path overflowed ${args.direction}` };
      }
      plan.set(step.id, step.to);
      displacedIds.add(step.id);
      steps.push(step);
      newPressureRects.push(step.to);
    }
    pressureRects = newPressureRects;
  }

  return { accepted: false, widgets: args.widgets, plan: null, reason: 'adjacent push exceeded safety guard' };
}

function makeRoomAdjacent(args: {
  readonly widgets: readonly WidgetLayout[];
  readonly moving: WidgetLayout;
  readonly target: Rect;
  readonly grid: GridConfig;
  readonly directionHint?: Direction;
}): CollisionResolveResult {
  const directions = directionCandidates(args.moving, args.target, args.directionHint);
  let lastReason = 'no adjacent direction found';
  for (const direction of directions) {
    const result = attemptAdjacentDirection({ ...args, direction });
    if (result.accepted) return result;
    lastReason = result.reason ?? lastReason;
  }
  return { accepted: false, widgets: args.widgets, plan: null, reason: lastReason };
}

export function resolvePlacement(args: {
  readonly widgets: readonly WidgetLayout[];
  readonly movingId: WidgetId;
  readonly target: Rect;
  readonly grid: GridConfig;
  readonly collisionMode: CollisionMode;
  readonly directionHint?: Direction;
}): CollisionResolveResult {
  const moving = findWidget(args.widgets, args.movingId);
  if (moving === null) {
    return { accepted: false, widgets: args.widgets, plan: null, reason: `widget not found: ${args.movingId}` };
  }

  try {
    assertRectInGrid(args.target, args.grid);
  } catch (error) {
    return { accepted: false, widgets: args.widgets, plan: null, reason: error instanceof Error ? error.message : 'invalid target' };
  }

  if (args.target.w < moving.minW || args.target.h < moving.minH || args.target.w > moving.maxW || args.target.h > moving.maxH) {
    return { accepted: false, widgets: args.widgets, plan: null, reason: `size constraint violation for ${moving.id}` };
  }

  switch (args.collisionMode) {
    case 'reject':
      return rejectPlacement({ widgets: args.widgets, moving, target: args.target, grid: args.grid });
    case 'make-room-free':
      return makeRoomFree({ widgets: args.widgets, moving, target: args.target, grid: args.grid });
    case 'make-room-adjacent':
      return makeRoomAdjacent({
        widgets: args.widgets,
        moving,
        target: args.target,
        grid: args.grid,
        ...(args.directionHint !== undefined ? { directionHint: args.directionHint } : {})
      });
    default:
      return assertNever(args.collisionMode);
  }
}

export function transitionSignature(widgets: readonly WidgetLayout[]): string {
  return sortRectsByReadingOrder(widgets)
    .map((widget) => `${widget.id}:${rectSignature(widget)}`)
    .join('|');
}

export function hasCollision(widgets: readonly WidgetLayout[]): boolean {
  for (let i = 0; i < widgets.length; i += 1) {
    const a = widgets[i];
    invariant(a !== undefined, 'unexpected missing widget');
    for (let j = i + 1; j < widgets.length; j += 1) {
      const b = widgets[j];
      invariant(b !== undefined, 'unexpected missing widget');
      if (intersects(a, b)) return true;
    }
  }
  return false;
}

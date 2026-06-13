import { invariant } from "./assert";
import type {
  DashboardViewport,
  GridConfig,
  GridRenderConfig,
  PixelRect,
  Point,
  Rect,
  SquareGridMetrics
} from "./types";

export function assertInteger(value: number, name: string): void {
  invariant(Number.isInteger(value), `${name} must be an integer`);
}

export function assertGridConfig(grid: GridConfig): void {
  assertInteger(grid.cols, 'grid.cols');
  assertInteger(grid.rows, 'grid.rows');
  invariant(grid.cols > 0, 'grid.cols must be greater than 0');
  invariant(grid.rows > 0, 'grid.rows must be greater than 0');
}

export function assertRectInteger(rect: Rect): void {
  assertInteger(rect.page, 'rect.page');
  assertInteger(rect.x, 'rect.x');
  assertInteger(rect.y, 'rect.y');
  assertInteger(rect.w, 'rect.w');
  assertInteger(rect.h, 'rect.h');
}

export function assertRectInGrid(rect: Rect, grid: GridConfig): void {
  assertGridConfig(grid);
  assertRectInteger(rect);
  invariant(rect.page >= 0, 'rect.page must be greater than or equal to 0');
  invariant(rect.x >= 0, 'rect.x must be greater than or equal to 0');
  invariant(rect.y >= 0, 'rect.y must be greater than or equal to 0');
  invariant(rect.w > 0, 'rect.w must be greater than 0');
  invariant(rect.h > 0, 'rect.h must be greater than 0');
  invariant(rect.x + rect.w <= grid.cols, `rect exceeds grid columns: x + w must be <= ${grid.cols}`);
  invariant(rect.y + rect.h <= grid.rows, `rect exceeds grid rows: y + h must be <= ${grid.rows}`);
}

export function clampRectToGrid(rect: Rect, grid: GridConfig): Rect {
  const w = Math.max(1, Math.min(rect.w, grid.cols));
  const h = Math.max(1, Math.min(rect.h, grid.rows));
  const x = Math.max(0, Math.min(rect.x, grid.cols - w));
  const y = Math.max(0, Math.min(rect.y, grid.rows - h));
  return { page: Math.max(0, rect.page), x, y, w, h };
}

export function rectEquals(a: Rect, b: Rect): boolean {
  return a.page === b.page && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function intersects(a: Rect, b: Rect): boolean {
  if (a.page !== b.page) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function containsPoint(rect: PixelRect, point: Point): boolean {
  return point.x >= rect.left && point.x <= rect.left + rect.width && point.y >= rect.top && point.y <= rect.top + rect.height;
}

export function rectArea(rect: Rect): number {
  return rect.w * rect.h;
}

export function sortRectsByReadingOrder<T extends Rect>(rects: readonly T[]): T[] {
  return [...rects].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x || a.h - b.h || a.w - b.w);
}

export function rectSignature(rect: Rect): string {
  return `${rect.page}:${rect.x},${rect.y},${rect.w},${rect.h}`;
}

export function computeSquareGridMetrics(
  viewport: DashboardViewport,
  config: GridRenderConfig
): SquareGridMetrics {
  assertGridConfig(config);
  invariant(config.gapPx >= 0, 'gapPx must be greater than or equal to 0');
  invariant(config.paddingPx >= 0, 'paddingPx must be greater than or equal to 0');

  const usableWidth = Math.max(0, viewport.width - config.paddingPx * 2 - config.gapPx * (config.cols - 1));
  const usableHeight = Math.max(0, viewport.height - config.paddingPx * 2 - config.gapPx * (config.rows - 1));
  const cellSizePx = Math.floor(Math.min(usableWidth / config.cols, usableHeight / config.rows));
  const gridWidthPx = cellSizePx * config.cols + config.gapPx * (config.cols - 1);
  const gridHeightPx = cellSizePx * config.rows + config.gapPx * (config.rows - 1);
  const gridLeftPx = viewport.left + (viewport.width - gridWidthPx) / 2;
  const gridTopPx = viewport.top + (viewport.height - gridHeightPx) / 2;

  return {
    cellSizePx,
    gapPx: config.gapPx,
    paddingPx: config.paddingPx,
    gridLeftPx,
    gridTopPx,
    gridWidthPx,
    gridHeightPx
  };
}

export function rectToPixels(rect: Rect, metrics: SquareGridMetrics): PixelRect {
  const unit = metrics.cellSizePx + metrics.gapPx;
  return {
    left: metrics.gridLeftPx + rect.x * unit,
    top: metrics.gridTopPx + rect.y * unit,
    width: rect.w * metrics.cellSizePx + (rect.w - 1) * metrics.gapPx,
    height: rect.h * metrics.cellSizePx + (rect.h - 1) * metrics.gapPx
  };
}

export function pointerToLocalGridPoint(pointerClient: Point, metrics: SquareGridMetrics): Point {
  return {
    x: pointerClient.x - metrics.gridLeftPx,
    y: pointerClient.y - metrics.gridTopPx
  };
}

export function pointerToCandidateRect(args: {
  readonly pointerClient: Point;
  readonly grabOffsetPx: Point;
  readonly size: Pick<Rect, 'w' | 'h'>;
  readonly page: number;
  readonly grid: GridConfig;
  readonly metrics: SquareGridMetrics;
}): Rect {
  const unit = args.metrics.cellSizePx + args.metrics.gapPx;
  const originX = args.pointerClient.x - args.metrics.gridLeftPx - args.grabOffsetPx.x;
  const originY = args.pointerClient.y - args.metrics.gridTopPx - args.grabOffsetPx.y;
  const x = Math.round(originX / unit);
  const y = Math.round(originY / unit);
  return clampRectToGrid({ page: args.page, x, y, w: args.size.w, h: args.size.h }, args.grid);
}

export function pixelRectToGridAlignedRect(args: {
  readonly pixelRect: PixelRect;
  readonly page: number;
  readonly size: Pick<Rect, 'w' | 'h'>;
  readonly grid: GridConfig;
  readonly metrics: SquareGridMetrics;
}): Rect {
  const unit = args.metrics.cellSizePx + args.metrics.gapPx;
  const x = Math.round((args.pixelRect.left - args.metrics.gridLeftPx) / unit);
  const y = Math.round((args.pixelRect.top - args.metrics.gridTopPx) / unit);
  return clampRectToGrid({ page: args.page, x, y, w: args.size.w, h: args.size.h }, args.grid);
}

export function gridBounds(metrics: SquareGridMetrics): PixelRect {
  return {
    left: metrics.gridLeftPx,
    top: metrics.gridTopPx,
    width: metrics.gridWidthPx,
    height: metrics.gridHeightPx
  };
}

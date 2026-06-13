import { useEffect, useRef, useState } from "react";

import { FaPlus } from "react-icons/fa6";

import { WidgetPickerModal } from "../components/WidgetPickerModal";
import {
  BREAKPOINTS,
  COLS,
  CONTAINER_PADDING,
  EMPTY_GRID_LAYOUTS,
  GRID_MARGIN,
  ROW_HEIGHT
} from "../dashboard/constants";
import { findDisplayLayout, toRglLayouts } from "../dashboard/layout";
import type { GridItemLayout, GridLayouts } from "../dashboard/types";
import { canScrollInside, findScrollableAncestor } from "../dashboard/utils";

import { useDashboardLogWidget } from "../hooks/useDashboardLogWidget";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";
import { useDashboardWorkspace } from "../hooks/useDashboardWorkspace";

import type {
  ApplicationJob,
  ApplicationListItem,
  DashboardBreakpoint,
  SystemEvent,
  SystemStatus
} from "../types";

import { DashboardWidgetRenderer } from "../widgets/dashboard/DashboardWidgetRenderer";

const PAGE_SWITCH_OUTSIDE_THRESHOLD_PX = 22;
const PAGE_EDGE_INITIAL_DELAY_MS = 240;
const PAGE_EDGE_REPEAT_MS = 240;
const GRID_VERTICAL_CHROME = CONTAINER_PADDING[1] * 2 - GRID_MARGIN[1];

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenEvents: () => void;
  onOpenDetail: (applicationId: string) => void;
};

type DragPreviewState = {
  widgetId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

type FrameSize = {
  width: number;
  height: number;
};

type GridMetrics = {
  cellWidth: number;
  cellHeight: number;
  unitWidth: number;
  unitHeight: number;
};

type InteractionState = {
  kind: "drag" | "resize";
  widgetId: string;
  pageId: string;
  startLayout: GridItemLayout;
  draftLayout: GridItemLayout;
  offsetX: number;
  offsetY: number;
  startClientX: number;
  startClientY: number;
  resizeDirection?: ResizeDirection;
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ToastTone = "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

function resolveBreakpoint(width: number): DashboardBreakpoint {
  if (width >= BREAKPOINTS.lg) {
    return "lg";
  }

  if (width >= BREAKPOINTS.md) {
    return "md";
  }

  if (width >= BREAKPOINTS.sm) {
    return "sm";
  }

  return "xs";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildGridMetrics(frameSize: FrameSize, breakpoint: DashboardBreakpoint): GridMetrics {
  const cols = COLS[breakpoint];
  const availableWidth = Math.max(0, frameSize.width - CONTAINER_PADDING[0] * 2 - GRID_MARGIN[0] * (cols - 1));
  const cellWidth = availableWidth / cols;

  return {
    cellWidth,
    cellHeight: ROW_HEIGHT,
    unitWidth: cellWidth + GRID_MARGIN[0],
    unitHeight: ROW_HEIGHT + GRID_MARGIN[1]
  };
}

function layoutToStyle(layout: GridItemLayout, metrics: GridMetrics): React.CSSProperties {
  return {
    left: CONTAINER_PADDING[0] + layout.x * metrics.unitWidth,
    top: CONTAINER_PADDING[1] + layout.y * metrics.unitHeight,
    width: layout.w * metrics.cellWidth + Math.max(0, layout.w - 1) * GRID_MARGIN[0],
    height: layout.h * metrics.cellHeight + Math.max(0, layout.h - 1) * GRID_MARGIN[1]
  };
}

function clampLayoutToGrid(layout: GridItemLayout, breakpoint: DashboardBreakpoint, maxRows: number): GridItemLayout {
  const maxW = layout.maxW ?? COLS[breakpoint];
  const maxH = layout.maxH ?? maxRows;
  const minW = layout.minW ?? 1;
  const minH = layout.minH ?? 1;
  const w = clamp(layout.w, minW, Math.min(maxW, COLS[breakpoint]));
  const h = clamp(layout.h, minH, Math.min(maxH, maxRows));
  const x = clamp(layout.x, 0, Math.max(0, COLS[breakpoint] - w));
  const y = clamp(layout.y, 0, Math.max(0, maxRows - h));

  return {
    ...layout,
    x,
    y,
    w,
    h
  };
}

function resolveDragLayout(
  pointer: MouseEvent,
  interaction: InteractionState,
  boundary: DOMRect,
  metrics: GridMetrics,
  breakpoint: DashboardBreakpoint,
  maxRows: number
): GridItemLayout {
  const rawX = Math.round(
    (pointer.clientX - boundary.left - CONTAINER_PADDING[0] - interaction.offsetX) / metrics.unitWidth
  );
  const rawY = Math.round(
    (pointer.clientY - boundary.top - CONTAINER_PADDING[1] - interaction.offsetY) / metrics.unitHeight
  );

  return clampLayoutToGrid(
    {
      ...interaction.startLayout,
      x: rawX,
      y: rawY
    },
    breakpoint,
    maxRows
  );
}

function resolveResizeLayout(
  pointer: MouseEvent,
  interaction: InteractionState,
  breakpoint: DashboardBreakpoint,
  maxRows: number,
  metrics: GridMetrics
): GridItemLayout {
  const deltaCols = Math.round((pointer.clientX - interaction.startClientX) / metrics.unitWidth);
  const deltaRows = Math.round((pointer.clientY - interaction.startClientY) / metrics.unitHeight);

  const direction = interaction.resizeDirection ?? "se";
  const next = { ...interaction.startLayout };

  if (direction.includes("e")) {
    next.w = interaction.startLayout.w + deltaCols;
  }

  if (direction.includes("s")) {
    next.h = interaction.startLayout.h + deltaRows;
  }

  if (direction.includes("w")) {
    next.x = interaction.startLayout.x + deltaCols;
    next.w = interaction.startLayout.w - deltaCols;
  }

  if (direction.includes("n")) {
    next.y = interaction.startLayout.y + deltaRows;
    next.h = interaction.startLayout.h - deltaRows;
  }

  return clampLayoutToGrid(
    next,
    breakpoint,
    maxRows
  );
}

export function HomeView(props: HomeViewProps) {
  const { system, applications, jobs, events, onOpenApplications, onOpenEvents, onOpenDetail } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentGridFrameRef = useRef<HTMLDivElement | null>(null);
  const touchScrollLockRef = useRef(false);
  const dragEdgeDirectionRef = useRef<-1 | 1 | null>(null);
  const dragEdgeTimerRef = useRef<number | null>(null);
  const dragEdgeIntervalRef = useRef<number | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const frameSizeRef = useRef<FrameSize>({ width: 0, height: 0 });
  const breakpointRef = useRef<DashboardBreakpoint>("lg");
  const maxRowsRef = useRef(1);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [maxRows, setMaxRows] = useState(1);
  const [frameSize, setFrameSize] = useState<FrameSize>({ width: 0, height: 0 });
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const { metrics, metricsHistory } = useDashboardMetrics();
  const { logWidget, logSourceOptions, setApplicationId, setSelectedService } = useDashboardLogWidget(applications);

  const {
    dashboard,
    saveState,
    editMode,
    setEditMode,
    widgetPickerOpen,
    setWidgetPickerOpen,
    breakpoint,
    setBreakpoint,
    isLayoutInteracting,
    setIsLayoutInteracting,
    isPageAnimating,
    currentPage,
    currentPageIndex,
    currentLayouts,
    changePage,
    applyWidgetRect,
    repairDashboard,
    addWidget,
    deleteWidget,
    clearAllWidgets,
    beginWidgetDrag,
    shiftDraggingWidgetPage,
    endWidgetDrag,
    flushSaveNow,
    findWidgetLayout
  } = useDashboardWorkspace();

  const gridMetrics = buildGridMetrics(frameSize, breakpoint);

  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);

  useEffect(() => {
    frameSizeRef.current = frameSize;
  }, [frameSize]);

  useEffect(() => {
    breakpointRef.current = breakpoint;
  }, [breakpoint]);

  useEffect(() => {
    maxRowsRef.current = maxRows;
  }, [maxRows]);

  useEffect(() => {
    if (!dashboard || maxRows < 1 || isLayoutInteracting) {
      return;
    }

    repairDashboard(maxRows, breakpoint);
  }, [dashboard?.currentPageId, maxRows, breakpoint, isLayoutInteracting, repairDashboard]);

  useEffect(() => {
    if (editMode) {
      return;
    }

    setWidgetPickerOpen(false);
    clearDragEdgeNavigation();
    interactionRef.current = null;
    setInteraction(null);
    setIsLayoutInteracting(false);
    setDragPreview(null);
    endWidgetDrag(maxRows, breakpoint);
  }, [editMode, maxRows, breakpoint, endWidgetDrag, setIsLayoutInteracting]);

  function toggleEditMode() {
    if (!editMode) {
      repairDashboard(maxRows, breakpoint);
      return setEditMode(true);
    }

    flushSaveNow();
    endWidgetDrag(maxRows, breakpoint, true);
    setEditMode(false);
  }

  function pushToast(message: string, tone: ToastTone = "error") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((previous) => [...previous, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, 2800);
  }

  function clearDragEdgeNavigation() {
    dragEdgeDirectionRef.current = null;

    if (dragEdgeTimerRef.current) {
      window.clearTimeout(dragEdgeTimerRef.current);
      dragEdgeTimerRef.current = null;
    }

    if (dragEdgeIntervalRef.current) {
      window.clearInterval(dragEdgeIntervalRef.current);
      dragEdgeIntervalRef.current = null;
    }
  }

  function startDragEdgeNavigation(direction: -1 | 1) {
    if (dragEdgeDirectionRef.current === direction) {
      return;
    }

    clearDragEdgeNavigation();
    dragEdgeDirectionRef.current = direction;

    dragEdgeTimerRef.current = window.setTimeout(() => {
      shiftDraggingWidgetPage(direction, maxRowsRef.current, breakpointRef.current);

      dragEdgeIntervalRef.current = window.setInterval(() => {
        shiftDraggingWidgetPage(direction, maxRowsRef.current, breakpointRef.current);
      }, PAGE_EDGE_REPEAT_MS);
    }, PAGE_EDGE_INITIAL_DELAY_MS);
  }

  function handleGridDrag(event: MouseEvent) {
    const boundary = rootRef.current?.getBoundingClientRect();

    if (!boundary) {
      clearDragEdgeNavigation();
      return;
    }

    if (event.clientY <= boundary.top - PAGE_SWITCH_OUTSIDE_THRESHOLD_PX) {
      startDragEdgeNavigation(-1);
      return;
    }

    if (event.clientY >= boundary.bottom + PAGE_SWITCH_OUTSIDE_THRESHOLD_PX) {
      startDragEdgeNavigation(1);
      return;
    }

    clearDragEdgeNavigation();
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!dashboard || isLayoutInteracting || isPageAnimating || Math.abs(event.deltaY) < 24) {
      return;
    }

    const scrollable = findScrollableAncestor(event.target, rootRef.current);

    if (scrollable && canScrollInside(scrollable, event.deltaY)) {
      return;
    }

    event.preventDefault();
    changePage(currentPageIndex + (event.deltaY > 0 ? 1 : -1));
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    setTouchStartY(event.touches[0]?.clientY ?? null);
    touchScrollLockRef.current = Boolean(findScrollableAncestor(event.target, rootRef.current));
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartY === null || !dashboard || isLayoutInteracting || isPageAnimating || touchScrollLockRef.current) {
      touchScrollLockRef.current = false;
      return;
    }

    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const diff = touchStartY - endY;

    if (Math.abs(diff) < 48) {
      return;
    }

    changePage(currentPageIndex + (diff > 0 ? 1 : -1));
    setTouchStartY(null);
    touchScrollLockRef.current = false;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      changePage(currentPageIndex + 1);
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      changePage(currentPageIndex - 1);
    }
  }

  function finishInteraction() {
    const active = interactionRef.current;

    clearDragEdgeNavigation();

    if (active) {
      const result = applyWidgetRect(active.widgetId, active.draftLayout, maxRowsRef.current, breakpointRef.current);
      if (!result.applied) {
        pushToast("重ねて配置することはできません。別の位置へ配置してください。", "error");
      }
    }

    interactionRef.current = null;
    setInteraction(null);
    setIsLayoutInteracting(false);
    setDragPreview(null);
    endWidgetDrag(maxRowsRef.current, breakpointRef.current, false);
  }

  useEffect(() => {
    if (!interaction) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const active = interactionRef.current;
      const boundary = currentGridFrameRef.current?.getBoundingClientRect();

      if (!active || !boundary) {
        return;
      }

      const activeMetrics = buildGridMetrics(frameSizeRef.current, breakpointRef.current);

      if (active.kind === "drag") {
        handleGridDrag(event);
        setDragPreview((previous) =>
          previous
            ? {
                ...previous,
                left: event.clientX - previous.offsetX,
                top: event.clientY - previous.offsetY
              }
            : previous
        );

        const nextLayout = resolveDragLayout(
          event,
          active,
          boundary,
          activeMetrics,
          breakpointRef.current,
          maxRowsRef.current
        );
        const nextInteraction = {
          ...active,
          draftLayout: nextLayout
        };
        interactionRef.current = nextInteraction;
        setInteraction(nextInteraction);
        return;
      }

      const nextLayout = resolveResizeLayout(
        event,
        active,
        breakpointRef.current,
        maxRowsRef.current,
        activeMetrics
      );
      const nextInteraction = {
        ...active,
        draftLayout: nextLayout
      };
      interactionRef.current = nextInteraction;
      setInteraction(nextInteraction);
    }

    function handleMouseUp() {
      finishInteraction();
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [interaction, applyWidgetRect, endWidgetDrag, setIsLayoutInteracting]);

  useEffect(() => {
    const element = currentGridFrameRef.current;

    if (!element) {
      return;
    }

    const updateMeasurements = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      const nextRows = Math.max(1, Math.floor((height - GRID_VERTICAL_CHROME) / (ROW_HEIGHT + GRID_MARGIN[1])));

      setFrameSize({ width, height });
      setMaxRows(nextRows);
      setBreakpoint(resolveBreakpoint(width));
    };

    updateMeasurements();

    const observer = new ResizeObserver(() => {
      updateMeasurements();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [currentPage?.id, setBreakpoint]);

  function startWidgetInteraction(
    event: React.MouseEvent<HTMLDivElement>,
    widgetId: string,
    pageId: string,
    layout: GridItemLayout
  ) {
    if (!editMode) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const resizeHandle = target.closest(".widget-resize-handle");
    const dragHandle = target.closest(".widget-drag-handle");
    const actionButton = target.closest("button");
    const resizeDirection = resizeHandle?.getAttribute("data-resize-direction") as ResizeDirection | null;

    if (!resizeHandle && (!dragHandle || actionButton)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const nextInteraction: InteractionState = {
      kind: resizeHandle ? "resize" : "drag",
      widgetId,
      pageId,
      startLayout: layout,
      draftLayout: layout,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startClientX: event.clientX,
      startClientY: event.clientY,
      resizeDirection: resizeDirection ?? undefined
    };

    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
    setIsLayoutInteracting(true);

    if (!resizeHandle) {
      beginWidgetDrag(widgetId);
      setDragPreview({
        widgetId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div className="flex items-center justify-end gap-2 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            saveState === "error"
              ? "bg-rose-100 text-rose-700"
              : saveState === "saving"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {saveState === "saving" ? "レイアウト保存中" : saveState === "error" ? "保存失敗" : "保存済み"}
        </span>

        <button
          type="button"
          onClick={toggleEditMode}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            editMode ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {editMode ? "編集完了" : "レイアウト編集"}
        </button>

        <button
          type="button"
          onClick={clearAllWidgets}
          disabled={!editMode}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            editMode
              ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 opacity-70"
          }`}
          title={editMode ? "全ウィジェット削除" : "編集モード中のみ利用できます"}
        >
          全ウィジェット削除
        </button>

        {editMode ? (
          <button
            type="button"
            onClick={() => {
              setWidgetPickerOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <FaPlus />
            ウィジェット追加
          </button>
        ) : null}
      </div>

      {toasts.length > 0 ? (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <p key={toast.id} className={`notice ${toast.tone} toast-notice`}>
              {toast.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={rootRef}
          className="relative min-h-0 flex-1 overflow-hidden outline-none"
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <div
            className="flex h-full flex-col transition-transform duration-[400ms] ease-out"
            style={{ transform: `translateY(-${currentPageIndex * 100}%)` }}
          >
            {(dashboard?.pages ?? []).map((page, pageIndex) => {
              const pageLayouts: GridLayouts = dashboard
                ? page.id === currentPage?.id
                  ? currentLayouts
                  : toRglLayouts(dashboard, page.id)
                : EMPTY_GRID_LAYOUTS;
              const pageWidgets = dashboard?.widgets.filter((widget) => widget.pageId === page.id) ?? [];

              return (
                <section key={page.id} className="h-full min-h-0 shrink-0 p-4">
                  <div
                    ref={page.id === currentPage?.id ? currentGridFrameRef : null}
                    className={`relative h-full min-h-0 rounded-[1.8rem] border border-white/80 shadow-[0_26px_80px_-60px_rgba(15,23,42,0.6)] backdrop-blur transition ${
                      page.isDraft ? "bg-white/35 opacity-70" : "bg-white/65"
                    }`}
                  >
                    {dashboard ? (
                      <>
                        {page.isDraft ? (
                          <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-full border border-violet-200 bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm">
                            ドラフトページ
                          </div>
                        ) : null}

                        <div className="relative h-full min-h-0">
                          {pageWidgets.map((widget) => {
                            const layout = findDisplayLayout(pageLayouts, breakpoint, widget.id);
                            if (!layout) {
                              return null;
                            }

                            const widgetInteraction =
                              interaction?.widgetId === widget.id && page.id === currentPage?.id ? interaction : null;
                            const displayLayout = widgetInteraction?.draftLayout ?? layout;

                            return (
                              <div
                                key={widget.id}
                                className="absolute overflow-visible transition-[left,top,width,height] duration-200"
                                style={layoutToStyle(displayLayout, gridMetrics)}
                                onMouseDownCapture={(event) => startWidgetInteraction(event, widget.id, page.id, layout)}
                              >
                                {widgetInteraction ? (
                                  <div className="flex h-full min-h-0 items-center justify-center rounded-[1.4rem] border-2 border-dashed border-violet-300 bg-violet-100/45">
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">
                                      配置先
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <DashboardWidgetRenderer
                                      widget={widget}
                                      layout={layout}
                                      pageIndex={pageIndex}
                                      totalPages={dashboard.pages.length}
                                      breakpoint={breakpoint}
                                      editMode={editMode}
                                      onDelete={(widgetId) => deleteWidget(widgetId, maxRows, breakpoint)}
                                      system={system}
                                      applications={applications}
                                      jobs={jobs}
                                      events={events}
                                      metrics={metrics}
                                      metricsHistory={metricsHistory}
                                      dashboardPageCount={dashboard.pages.length}
                                      dashboardWidgetCount={dashboard.widgets.length}
                                      logWidget={logWidget}
                                      logSourceOptions={logSourceOptions}
                                      onLogApplicationChange={setApplicationId}
                                      onLogServiceChange={setSelectedService}
                                      onOpenApplications={onOpenApplications}
                                      onOpenEvents={onOpenEvents}
                                      onOpenDetail={onOpenDetail}
                                    />

                                    {editMode ? (
                                      <>
                                        <div className="widget-resize-handle absolute inset-x-3 -top-1 z-10 h-2 cursor-n-resize" data-resize-direction="n" />
                                        <div className="widget-resize-handle absolute inset-x-3 -bottom-1 z-10 h-2 cursor-s-resize" data-resize-direction="s" />
                                        <div className="widget-resize-handle absolute inset-y-3 -left-1 z-10 w-2 cursor-w-resize" data-resize-direction="w" />
                                        <div className="widget-resize-handle absolute inset-y-3 -right-1 z-10 w-2 cursor-e-resize" data-resize-direction="e" />
                                        <div className="widget-resize-handle absolute -left-1 -top-1 z-10 h-3.5 w-3.5 cursor-nw-resize" data-resize-direction="nw" />
                                        <div className="widget-resize-handle absolute -right-1 -top-1 z-10 h-3.5 w-3.5 cursor-ne-resize" data-resize-direction="ne" />
                                        <div className="widget-resize-handle absolute -left-1 -bottom-1 z-10 h-3.5 w-3.5 cursor-sw-resize" data-resize-direction="sw" />
                                        <div className="widget-resize-handle absolute -right-1 -bottom-1 z-10 h-3.5 w-3.5 cursor-se-resize" data-resize-direction="se" />
                                        <div className="pointer-events-none absolute bottom-2 right-2 z-10 h-4 w-4 text-violet-500">
                                          <span className="absolute bottom-0 right-0 block h-0.5 w-4 rotate-[-45deg] rounded-full bg-current" />
                                          <span className="absolute bottom-[0.35rem] right-[0.18rem] block h-0.5 w-2.75 rotate-[-45deg] rounded-full bg-current opacity-80" />
                                          <span className="absolute bottom-[0.7rem] right-[0.36rem] block h-0.5 w-1.5 rotate-[-45deg] rounded-full bg-current opacity-65" />
                                        </div>
                                      </>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {pageWidgets.length === 0 ? (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                            <div className="max-w-md rounded-[1.6rem] border border-dashed border-slate-300 bg-white/90 px-6 py-8 text-center shadow-sm">
                              <h4 className="text-lg font-bold text-slate-900">
                                {page.isDraft ? "ここにドロップすると新しいページを確定します" : "このページはまだ空です"}
                              </h4>

                              {page.isDraft ? (
                                <p className="mt-2 text-sm text-slate-500">
                                  末尾でさらに下へドラッグしたときだけ一時的に作られるドラフトページです。
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {dragPreview && dashboard ? (
          (() => {
            const previewWidget = dashboard.widgets.find((widget) => widget.id === dragPreview.widgetId);
            const previewLayout = findWidgetLayout(dragPreview.widgetId, breakpoint);

            return previewWidget ? (
              <div
                className="pointer-events-none fixed z-[80] overflow-hidden rounded-[1.4rem]"
                style={{
                  left: dragPreview.left,
                  top: dragPreview.top,
                  width: dragPreview.width,
                  height: dragPreview.height
                }}
              >
                <DashboardWidgetRenderer
                  widget={previewWidget}
                  layout={previewLayout}
                  pageIndex={currentPageIndex}
                  totalPages={dashboard.pages.length}
                  breakpoint={breakpoint}
                  editMode={true}
                  onDelete={(widgetId) => deleteWidget(widgetId, maxRows, breakpoint)}
                  system={system}
                  applications={applications}
                  jobs={jobs}
                  events={events}
                  metrics={metrics}
                  metricsHistory={metricsHistory}
                  dashboardPageCount={dashboard.pages.length}
                  dashboardWidgetCount={dashboard.widgets.length}
                  logWidget={logWidget}
                  logSourceOptions={logSourceOptions}
                  onLogApplicationChange={setApplicationId}
                  onLogServiceChange={setSelectedService}
                  onOpenApplications={onOpenApplications}
                  onOpenEvents={onOpenEvents}
                  onOpenDetail={onOpenDetail}
                />
              </div>
            ) : null;
          })()
        ) : null}

        <aside className="hidden w-24 shrink-0 flex-col items-center justify-center gap-3 pr-4 lg:flex">
          {(dashboard?.pages ?? []).map((page, pageIndex) => (
            <button
              key={page.id}
              type="button"
              onClick={() => changePage(pageIndex)}
              className={`group flex items-center gap-3 ${pageIndex === currentPageIndex ? "text-slate-900" : "text-slate-400"}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  pageIndex === currentPageIndex
                    ? page.isDraft
                      ? "bg-violet-300"
                      : "bg-violet-600"
                    : page.isDraft
                      ? "bg-slate-200"
                      : "bg-slate-300 group-hover:bg-slate-400"
                }`}
              />

              <span className="text-xs font-semibold">{page.isDraft ? "+" : pageIndex + 1}</span>
            </button>
          ))}
        </aside>
      </div>

      {widgetPickerOpen ? (
        <WidgetPickerModal
          breakpoint={breakpoint}
          onClose={() => setWidgetPickerOpen(false)}
          onSelect={(type) => addWidget(type, maxRows, breakpoint)}
        />
      ) : null}
    </div>
  );
}

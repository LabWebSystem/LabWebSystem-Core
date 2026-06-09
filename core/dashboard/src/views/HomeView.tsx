import { useEffect, useRef, useState } from "react";

import { Responsive, WidthProvider } from "react-grid-layout/legacy";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { FaPlus } from "react-icons/fa6";

import { WidgetPickerModal } from "../components/WidgetPickerModal";
import {
  BREAKPOINTS,
  COLS,
  CONTAINER_PADDING,
  GRID_MARGIN,
  ROW_HEIGHT
} from "../dashboard/constants";
import { findDisplayLayout, toRglLayouts } from "../dashboard/layout";
import type { GridItemLayout, GridLayouts } from "../dashboard/types";
import { canScrollInside, findScrollableAncestor } from "../dashboard/utils";

import { useDashboardLogWidget } from "../hooks/useDashboardLogWidget";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";
import { useDashboardWorkspace } from "../hooks/useDashboardWorkspace";

import type { ApplicationJob, ApplicationListItem, SystemEvent, SystemStatus } from "../types";

import { DashboardWidgetRenderer } from "../widgets/dashboard/DashboardWidgetRenderer";

const ResponsiveGridLayout = WidthProvider(Responsive as any) as any;

const PAGE_EDGE_THRESHOLD_PX = 96;
const PAGE_EDGE_INITIAL_DELAY_MS = 420;
const PAGE_EDGE_REPEAT_MS = 520;
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

function overlapsHorizontally(
  a: Pick<GridItemLayout, "x" | "w">,
  b: Pick<GridItemLayout, "x" | "w">
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

function getMaxHeightBeforeCollision(
  item: GridItemLayout,
  layout: GridItemLayout[],
  maxRows: number
): number {
  const nearestBottomBlockerY = layout
    .filter((other) => other.i !== item.i)
    .filter((other) => overlapsHorizontally(item, other))
    .filter((other) => other.y >= item.y + item.h)
    .reduce((nearestY, other) => Math.min(nearestY, other.y), maxRows);

  const minHeight = item.minH ?? 1;
  const maxHeightByGrid = Math.max(minHeight, maxRows - item.y);
  const maxHeightByCollision = Math.max(minHeight, nearestBottomBlockerY - item.y);
  const originalMaxHeight = item.maxH ?? maxHeightByGrid;

  return Math.max(
    minHeight,
    Math.min(originalMaxHeight, maxHeightByGrid, maxHeightByCollision)
  );
}

function applyResizeGuardsToLayout(
  layout: GridItemLayout[],
  maxRows: number
): GridItemLayout[] {
  return layout.map((item) => {
    const maxH = getMaxHeightBeforeCollision(item, layout, maxRows);

    return {
      ...item,
      maxH,
      h: Math.min(item.h, maxH)
    };
  });
}

function applyResizeGuardsToLayouts(
  layouts: GridLayouts,
  maxRows: number
): GridLayouts {
  return {
    lg: applyResizeGuardsToLayout(layouts.lg, maxRows),
    md: applyResizeGuardsToLayout(layouts.md, maxRows),
    sm: applyResizeGuardsToLayout(layouts.sm, maxRows),
    xs: applyResizeGuardsToLayout(layouts.xs, maxRows)
  };
}

function layoutFitsMaxRows(layout: GridItemLayout[], limit: number): boolean {
  return layout.every((item) => item.y + item.h <= limit);
}

function layoutsFitMaxRows(layouts: GridLayouts, limit: number): boolean {
  return (
    layoutFitsMaxRows(layouts.lg, limit) &&
    layoutFitsMaxRows(layouts.md, limit) &&
    layoutFitsMaxRows(layouts.sm, limit) &&
    layoutFitsMaxRows(layouts.xs, limit)
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
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [maxRows, setMaxRows] = useState(1);

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
    updateLayouts,
    addWidget,
    deleteWidget,
    beginWidgetDrag,
    shiftDraggingWidgetPage,
    endWidgetDrag
  } = useDashboardWorkspace();

  useEffect(() => {
    if (editMode) {
      return;
    }

    clearDragEdgeNavigation();
    setIsLayoutInteracting(false);
    endWidgetDrag();
  }, [editMode]);

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
      shiftDraggingWidgetPage(direction);

      dragEdgeIntervalRef.current = window.setInterval(() => {
        shiftDraggingWidgetPage(direction);
      }, PAGE_EDGE_REPEAT_MS);
    }, PAGE_EDGE_INITIAL_DELAY_MS);
  }

  function handleGridDrag(event: unknown) {
    if (!editMode || !(event instanceof MouseEvent)) {
      clearDragEdgeNavigation();
      return;
    }

    const boundary = rootRef.current?.getBoundingClientRect();

    if (!boundary) {
      clearDragEdgeNavigation();
      return;
    }

    const offsetY = event.clientY - boundary.top;

    if (offsetY <= PAGE_EDGE_THRESHOLD_PX) {
      startDragEdgeNavigation(-1);
      return;
    }

    if (offsetY >= boundary.height - PAGE_EDGE_THRESHOLD_PX) {
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

  useEffect(() => {
    const element = currentGridFrameRef.current;

    if (!element) {
      return;
    }

    const updateMaxRows = () => {
      const height = element.clientHeight;
      const nextRows = Math.max(1, Math.floor((height - GRID_VERTICAL_CHROME) / (ROW_HEIGHT + GRID_MARGIN[1])));

      setMaxRows(nextRows);
    };

    updateMaxRows();

    const observer = new ResizeObserver(() => {
      updateMaxRows();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [currentPage?.id]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div className="flex items-center justify-end gap-2 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${saveState === "error"
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
          onClick={() => setEditMode((previous) => !previous)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${editMode ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
        >
          {editMode ? "編集完了" : "レイアウト編集"}
        </button>

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
      </div>

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
                : { lg: [], md: [], sm: [], xs: [] };

              const guardedPageLayouts = applyResizeGuardsToLayouts(pageLayouts, maxRows);

              const interactivePageLayouts: GridLayouts = editMode
                ? guardedPageLayouts
                : {
                  lg: guardedPageLayouts.lg.map((item) => ({
                    ...item,
                    static: true,
                    isDraggable: false,
                    isResizable: false
                  })),
                  md: guardedPageLayouts.md.map((item) => ({
                    ...item,
                    static: true,
                    isDraggable: false,
                    isResizable: false
                  })),
                  sm: guardedPageLayouts.sm.map((item) => ({
                    ...item,
                    static: true,
                    isDraggable: false,
                    isResizable: false
                  })),
                  xs: guardedPageLayouts.xs.map((item) => ({
                    ...item,
                    static: true,
                    isDraggable: false,
                    isResizable: false
                  }))
                };

              const pageWidgets = dashboard?.widgets.filter((widget) => widget.pageId === page.id) ?? [];

              return (
                <section key={page.id} className="h-full min-h-0 shrink-0 p-4">
                  <div
                    ref={page.id === currentPage?.id ? currentGridFrameRef : null}
                    className={`relative h-full min-h-0 rounded-[1.8rem] border border-white/80 shadow-[0_26px_80px_-60px_rgba(15,23,42,0.6)] backdrop-blur transition ${page.isDraft ? "bg-white/35 opacity-70" : "bg-white/65"
                      }`}
                  >
                    {dashboard ? (
                      <>
                        <ResponsiveGridLayout
                          key={`${page.id}-${editMode ? "edit" : "view"}`}
                          className="layout h-full"
                          style={{ height: "100%" }}
                          breakpoints={BREAKPOINTS}
                          cols={COLS}
                          rowHeight={ROW_HEIGHT}
                          margin={GRID_MARGIN}
                          containerPadding={CONTAINER_PADDING}
                          maxRows={maxRows}
                          autoSize={false}
                          layouts={interactivePageLayouts}
                          isDraggable={editMode}
                          isResizable={editMode}
                          draggableHandle={editMode ? ".widget-drag-handle" : undefined}
                          preventCollision={true}
                          allowOverlap={false}
                          compactType={null}
                          resizeHandles={editMode ? ["se"] : []}
                          isBounded={true}
                          onBreakpointChange={(nextBreakpoint: string) => setBreakpoint(nextBreakpoint as typeof breakpoint)}
                          onLayoutChange={(_: unknown, nextLayouts: unknown) => {
                            if (!editMode || page.id !== currentPage?.id) {
                              return;
                            }

                            const candidateLayouts = nextLayouts as GridLayouts;

                            if (!layoutsFitMaxRows(candidateLayouts, maxRows)) {
                              return;
                            }

                            updateLayouts(candidateLayouts);
                          }}
                          onDragStart={(_: unknown, __: unknown, item: { i?: string }) => {
                            setIsLayoutInteracting(true);

                            if (item?.i) {
                              beginWidgetDrag(item.i);
                            }
                          }}
                          onDrag={(_: unknown, __: unknown, ___: unknown, ____: unknown, event: unknown) => {
                            handleGridDrag(event);
                          }}
                          onDragStop={() => {
                            clearDragEdgeNavigation();
                            setIsLayoutInteracting(false);
                            endWidgetDrag();
                          }}
                          onResizeStart={() => setIsLayoutInteracting(true)}
                          onResizeStop={() => setIsLayoutInteracting(false)}
                        >
                          {pageWidgets.map((widget) => (
                            <div key={widget.id} className="overflow-hidden">
                              <DashboardWidgetRenderer
                                widget={widget}
                                layout={findDisplayLayout(guardedPageLayouts, breakpoint, widget.id)}
                                pageIndex={pageIndex}
                                totalPages={dashboard.pages.length}
                                breakpoint={breakpoint}
                                editMode={editMode}
                                onDelete={deleteWidget}
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
                          ))}
                        </ResponsiveGridLayout>

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

        <aside className="hidden w-24 shrink-0 flex-col items-center justify-center gap-3 pr-4 lg:flex">
          {(dashboard?.pages ?? []).map((page, pageIndex) => (
            <button
              key={page.id}
              type="button"
              onClick={() => changePage(pageIndex)}
              className={`group flex items-center gap-3 ${pageIndex === currentPageIndex ? "text-slate-900" : "text-slate-400"}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${pageIndex === currentPageIndex
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
          onSelect={(type) => addWidget(type, maxRows)}
        />
      ) : null}
    </div>
  );
}
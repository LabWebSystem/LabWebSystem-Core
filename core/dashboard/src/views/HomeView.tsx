import { useRef, useState } from "react";
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
import { canScrollInside, findScrollableAncestor } from "../dashboard/utils";
import { pageBadgeLabel } from "../dashboard/widgetDefinitions";
import { useDashboardLogWidget } from "../hooks/useDashboardLogWidget";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";
import { useDashboardWorkspace } from "../hooks/useDashboardWorkspace";
import type { ApplicationJob, ApplicationListItem, SystemEvent, SystemStatus } from "../types";
import { DashboardWidgetRenderer } from "../widgets/dashboard/DashboardWidgetRenderer";

const ResponsiveGridLayout = WidthProvider(Responsive as any) as any;

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenEvents: () => void;
  onOpenDetail: (applicationId: string) => void;
};

export function HomeView(props: HomeViewProps) {
  const { system, applications, jobs, events, onOpenApplications, onOpenEvents, onOpenDetail } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const touchScrollLockRef = useRef(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const { metrics, metricsHistory } = useDashboardMetrics();
  const { logWidget, logSourceOptions, setApplicationId, setSelectedService } = useDashboardLogWidget(applications);
  const {
    dashboard,
    saveState,
    editMode,
    setEditMode,
    widgetPickerOpen,
    setWidgetPickerOpen,
    widgetPickerTarget,
    setWidgetPickerTarget,
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
    addPage,
    removeCurrentPage,
    addWidget,
    deleteWidget,
    moveWidgetPage
  } = useDashboardWorkspace();

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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-4 backdrop-blur">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Monitoring Dashboard</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">固定トピックに縛られない、可変ページ型の監視ワークスペース</h2>
          <p className="mt-1 text-sm text-slate-500">ページは必要な分だけ増やせて、各ウィジェットは最小サイズとサイズ別表示を持ちます。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            onClick={addPage}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ページ追加
          </button>
          <button
            type="button"
            onClick={() => setEditMode((previous) => !previous)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              editMode ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {editMode ? "編集完了" : "レイアウト編集"}
          </button>
          <button
            type="button"
            onClick={() => {
              setWidgetPickerTarget("current");
              setWidgetPickerOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <FaPlus />
            ウィジェット追加
          </button>
        </div>
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
              const pageLayouts = dashboard
                ? page.id === currentPage?.id
                  ? currentLayouts
                  : toRglLayouts(dashboard, page.id)
                : { lg: [], md: [], sm: [], xs: [] };
              const pageWidgets = dashboard?.widgets.filter((widget) => widget.pageId === page.id) ?? [];

              return (
                <section key={page.id} className="h-full min-h-0 shrink-0 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">{pageBadgeLabel(pageIndex)}</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">{page.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {pageWidgets.length} widgets · {COLS[breakpoint]} cols · min-size aware
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>12px gap</span>
                      <span>drag / resize enabled</span>
                      {page.id === currentPage?.id && editMode && pageWidgets.length === 0 && (dashboard?.pages.length ?? 0) > 1 ? (
                        <button
                          type="button"
                          onClick={removeCurrentPage}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          空ページ削除
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative h-[calc(100%-4rem)] min-h-0 rounded-[1.8rem] border border-white/80 bg-white/65 shadow-[0_26px_80px_-60px_rgba(15,23,42,0.6)] backdrop-blur">
                    {dashboard ? (
                      <>
                        <ResponsiveGridLayout
                          className="layout h-full"
                          breakpoints={BREAKPOINTS}
                          cols={COLS}
                          rowHeight={ROW_HEIGHT}
                          margin={GRID_MARGIN}
                          containerPadding={CONTAINER_PADDING}
                          layouts={pageLayouts}
                          isDraggable={editMode}
                          isResizable={editMode}
                          draggableHandle=".widget-drag-handle"
                          preventCollision={false}
                          allowOverlap={false}
                          compactType="vertical"
                          resizeHandles={["se"]}
                          onBreakpointChange={(nextBreakpoint: string) => setBreakpoint(nextBreakpoint as typeof breakpoint)}
                          onLayoutChange={(_: unknown, nextLayouts: unknown) => {
                            if (page.id !== currentPage?.id) {
                              return;
                            }
                            updateLayouts(nextLayouts as typeof currentLayouts);
                          }}
                          onDragStart={() => setIsLayoutInteracting(true)}
                          onDragStop={() => setIsLayoutInteracting(false)}
                          onResizeStart={() => setIsLayoutInteracting(true)}
                          onResizeStop={() => setIsLayoutInteracting(false)}
                        >
                          {pageWidgets.map((widget) => (
                            <div key={widget.id} className="overflow-hidden">
                              <DashboardWidgetRenderer
                                widget={widget}
                                layout={findDisplayLayout(pageLayouts, breakpoint, widget.id)}
                                pageIndex={pageIndex}
                                totalPages={dashboard.pages.length}
                                breakpoint={breakpoint}
                                editMode={editMode}
                                onDelete={deleteWidget}
                                onMovePage={moveWidgetPage}
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
                              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">{pageBadgeLabel(pageIndex)}</p>
                              <h4 className="mt-2 text-lg font-bold text-slate-900">このページはまだ空です</h4>
                              <p className="mt-2 text-sm text-slate-500">必要なウィジェットを追加するか、新しいページへそのまま拡張してください。</p>
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
          <button
            type="button"
            onClick={addPage}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            title="ページ追加"
          >
            <FaPlus />
          </button>
          {(dashboard?.pages ?? []).map((page, pageIndex) => (
            <button
              key={page.id}
              type="button"
              onClick={() => changePage(pageIndex)}
              className={`group flex items-center gap-3 ${pageIndex === currentPageIndex ? "text-slate-900" : "text-slate-400"}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  pageIndex === currentPageIndex ? "bg-violet-600" : "bg-slate-300 group-hover:bg-slate-400"
                }`}
              />
              <span className="text-xs font-semibold">{pageIndex + 1}</span>
            </button>
          ))}
        </aside>
      </div>

      {widgetPickerOpen ? (
        <WidgetPickerModal
          breakpoint={breakpoint}
          currentPageIndex={currentPageIndex}
          target={widgetPickerTarget}
          onTargetChange={setWidgetPickerTarget}
          onClose={() => setWidgetPickerOpen(false)}
          onSelect={(type) => addWidget(type, widgetPickerTarget)}
        />
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboardLayout, saveDashboardLayout } from "../api";
import {
  BREAKPOINT_KEYS,
  DASHBOARD_ID,
  EMPTY_GRID_LAYOUTS,
  PAGE_ANIMATION_MS,
  USER_ID
} from "../dashboard/constants";
import {
  buildDefaultDashboardLayout,
  cloneResponsiveLayouts,
  layoutPreset,
  mergeLayoutsForPage,
  normalizeDashboardLayout,
  renumberPages,
  toRglLayouts,
  widgetPreset
} from "../dashboard/layout";
import type { GridLayouts, SaveState, WidgetPickerTarget } from "../dashboard/types";
import type { DashboardBreakpoint, DashboardLayoutDocument, DashboardResponsiveLayouts, DashboardWidgetType } from "../types";

function createPage(index: number) {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Page ${index + 1}`
  };
}

export function useDashboardWorkspace() {
  const [dashboard, setDashboard] = useState<DashboardLayoutDocument | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [editMode, setEditMode] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [widgetPickerTarget, setWidgetPickerTarget] = useState<WidgetPickerTarget>("current");
  const [breakpoint, setBreakpoint] = useState<DashboardBreakpoint>("lg");
  const [isLayoutInteracting, setIsLayoutInteracting] = useState(false);
  const [isPageAnimating, setIsPageAnimating] = useState(false);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const currentPage = useMemo(() => {
    if (!dashboard) {
      return null;
    }
    return dashboard.pages.find((page) => page.id === dashboard.currentPageId) ?? dashboard.pages[0] ?? null;
  }, [dashboard]);

  const currentPageIndex = useMemo(() => {
    if (!dashboard || !currentPage) {
      return 0;
    }
    const index = dashboard.pages.findIndex((page) => page.id === currentPage.id);
    return index >= 0 ? index : 0;
  }, [dashboard, currentPage]);

  const currentLayouts = useMemo(
    () => (dashboard && currentPage ? toRglLayouts(dashboard, currentPage.id) : EMPTY_GRID_LAYOUTS),
    [dashboard, currentPage]
  );

  const widgetsOnCurrentPage = useMemo(
    () => (dashboard && currentPage ? dashboard.widgets.filter((widget) => widget.pageId === currentPage.id) : []),
    [dashboard, currentPage]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      try {
        const layoutResponse = await fetchDashboardLayout(DASHBOARD_ID, USER_ID);
        if (cancelled) {
          return;
        }
        setDashboard(normalizeDashboardLayout(layoutResponse.layout ?? buildDefaultDashboardLayout()));
        loadedRef.current = true;
      } catch {
        if (cancelled) {
          return;
        }
        setDashboard(buildDefaultDashboardLayout());
        loadedRef.current = true;
      }
    }

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dashboard || !loadedRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("saving");
      void saveDashboardLayout(dashboard, DASHBOARD_ID, USER_ID)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [dashboard]);

  function changePage(nextPageIndex: number) {
    if (!dashboard) {
      return;
    }
    if (
      nextPageIndex < 0 ||
      nextPageIndex >= dashboard.pages.length ||
      nextPageIndex === currentPageIndex ||
      isLayoutInteracting ||
      isPageAnimating
    ) {
      return;
    }

    const nextPage = dashboard.pages[nextPageIndex];
    if (!nextPage) {
      return;
    }

    setIsPageAnimating(true);
    setDashboard((previous) => (previous ? { ...previous, currentPageId: nextPage.id } : previous));
    window.setTimeout(() => setIsPageAnimating(false), PAGE_ANIMATION_MS);
  }

  function updateLayouts(nextLayouts: GridLayouts) {
    setDashboard((previous) => {
      if (!previous || !currentPage) {
        return previous;
      }

      return {
        ...previous,
        layouts: mergeLayoutsForPage(previous.layouts, currentPage.id, nextLayouts, previous.widgets)
      };
    });
  }

  function addPage() {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const pages = renumberPages([...previous.pages, createPage(previous.pages.length)]);
      const nextPage = pages[pages.length - 1];
      if (!nextPage) {
        return previous;
      }

      return {
        ...previous,
        pages,
        currentPageId: nextPage.id
      };
    });
  }

  function removeCurrentPage() {
    if (!dashboard || !currentPage) {
      return;
    }
    if (dashboard.pages.length <= 1 || widgetsOnCurrentPage.length > 0) {
      return;
    }
    if (!window.confirm("空のページを削除しますか？")) {
      return;
    }

    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const index = previous.pages.findIndex((page) => page.id === previous.currentPageId);
      if (index < 0 || previous.pages.length <= 1) {
        return previous;
      }

      const pages = renumberPages(previous.pages.filter((page) => page.id !== previous.currentPageId));
      const fallbackIndex = Math.max(0, Math.min(index - 1, pages.length - 1));
      const fallbackPage = pages[fallbackIndex];
      if (!fallbackPage) {
        return previous;
      }

      return {
        ...previous,
        pages,
        currentPageId: fallbackPage.id
      };
    });
  }

  function addWidget(type: DashboardWidgetType, target: WidgetPickerTarget) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      let pages = previous.pages;
      let targetPageId = previous.currentPageId;

      if (target === "new-page") {
        pages = renumberPages([...previous.pages, createPage(previous.pages.length)]);
        targetPageId = pages[pages.length - 1]?.id ?? previous.currentPageId;
      }

      const widget = widgetPreset(type, targetPageId);
      const nextLayouts = cloneResponsiveLayouts(previous.layouts);
      for (const breakpointKey of BREAKPOINT_KEYS) {
        const pageItems = nextLayouts[breakpointKey].filter((item) => item.pageId === targetPageId);
        const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        nextLayouts[breakpointKey].push(layoutPreset(widget, breakpointKey, bottomY));
      }

      return {
        ...previous,
        pages,
        currentPageId: targetPageId,
        widgets: [...previous.widgets, widget],
        layouts: nextLayouts
      };
    });
    setWidgetPickerOpen(false);
  }

  function deleteWidget(widgetId: string) {
    if (!window.confirm("このウィジェットを削除しますか？")) {
      return;
    }

    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        widgets: previous.widgets.filter((widget) => widget.id !== widgetId),
        layouts: Object.fromEntries(
          BREAKPOINT_KEYS.map((breakpointKey) => [
            breakpointKey,
            previous.layouts[breakpointKey].filter((item) => item.i !== widgetId)
          ])
        ) as DashboardResponsiveLayouts
      };
    });
  }

  function moveWidgetPage(widgetId: string, delta: -1 | 1) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const widget = previous.widgets.find((candidate) => candidate.id === widgetId);
      if (!widget) {
        return previous;
      }

      const currentIndex = previous.pages.findIndex((page) => page.id === widget.pageId);
      if (currentIndex < 0) {
        return previous;
      }

      let pages = previous.pages;
      let targetIndex = currentIndex + delta;

      if (delta === 1 && targetIndex >= pages.length) {
        pages = renumberPages([...pages, createPage(pages.length)]);
        targetIndex = pages.length - 1;
      }

      if (targetIndex < 0 || targetIndex >= pages.length) {
        return previous;
      }

      const targetPage = pages[targetIndex];
      if (!targetPage || targetPage.id === widget.pageId) {
        return previous;
      }

      const widgets = previous.widgets.map((candidate) =>
        candidate.id === widgetId ? { ...candidate, pageId: targetPage.id } : candidate
      );

      const layouts = Object.fromEntries(
        BREAKPOINT_KEYS.map((breakpointKey) => {
          const pageItems = previous.layouts[breakpointKey].filter((item) => item.pageId === targetPage.id);
          const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);

          return [
            breakpointKey,
            previous.layouts[breakpointKey].map((item) =>
              item.i === widgetId
                ? {
                    ...item,
                    pageId: targetPage.id,
                    x: 0,
                    y: bottomY
                  }
                : item
            )
          ];
        })
      ) as DashboardResponsiveLayouts;

      return {
        ...previous,
        pages,
        widgets,
        layouts,
        currentPageId: targetPage.id
      };
    });
  }

  return {
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
    widgetsOnCurrentPage,
    changePage,
    updateLayouts,
    addPage,
    removeCurrentPage,
    addWidget,
    deleteWidget,
    moveWidgetPage
  };
}

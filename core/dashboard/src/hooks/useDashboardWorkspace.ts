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
  addWidgetToDashboardDocument,
  findWidgetLayoutForBreakpoint,
  moveWidgetToPageInDashboardDocument,
  tryApplyWidgetRectOnDashboardDocument
} from "../dashboard/moduleAdapter";
import type { WidgetRectApplyResult } from "../dashboard/moduleAdapter";
import {
  buildDefaultDashboardLayout,
  normalizeDashboardLayout,
  sanitizeDashboardDocument,
  toRglLayouts
} from "../dashboard/layout";
import type { GridLayouts, SaveState } from "../dashboard/types";
import type {
  DashboardBreakpoint,
  DashboardLayoutDocument,
  DashboardResponsiveLayouts,
  DashboardWidgetType
} from "../types";

function createPage(index: number, isDraft = false) {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Page ${index + 1}`,
    isDraft
  };
}

function pulsePageAnimation(setIsPageAnimating: (value: boolean) => void) {
  setIsPageAnimating(true);
  window.setTimeout(() => setIsPageAnimating(false), PAGE_ANIMATION_MS);
}

function createEmptyLayouts(): DashboardResponsiveLayouts {
  return Object.fromEntries(BREAKPOINT_KEYS.map((breakpoint) => [breakpoint, []])) as unknown as DashboardResponsiveLayouts;
}

function mergeLayoutsForPage(
  currentLayouts: DashboardResponsiveLayouts,
  pageId: string,
  nextLayouts: GridLayouts,
  widgetIds: Set<string>
): DashboardResponsiveLayouts {
  return Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => {
      const preserved = currentLayouts[breakpoint].filter((item) => item.pageId !== pageId);
      const replacement = nextLayouts[breakpoint]
        .filter((item) => widgetIds.has(item.i))
        .map((item) => ({
          i: item.i,
          pageId,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: item.minW,
          minH: item.minH,
          maxW: item.maxW,
          maxH: item.maxH,
          static: item.static,
          isDraggable: item.isDraggable,
          isResizable: item.isResizable
        }));

      return [breakpoint, [...preserved, ...replacement]];
    })
  ) as DashboardResponsiveLayouts;
}

export function useDashboardWorkspace() {
  const [dashboard, setDashboard] = useState<DashboardLayoutDocument | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [editMode, setEditMode] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [breakpoint, setBreakpoint] = useState<DashboardBreakpoint>("lg");
  const [isLayoutInteracting, setIsLayoutInteracting] = useState(false);
  const [isPageAnimating, setIsPageAnimating] = useState(false);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const draggingWidgetIdRef = useRef<string | null>(null);

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
    if (!dashboard || !loadedRef.current || isLayoutInteracting) {
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
  }, [dashboard, isLayoutInteracting]);

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

    pulsePageAnimation(setIsPageAnimating);
    setDashboard((previous) => (previous ? { ...previous, currentPageId: nextPage.id } : previous));
  }

  function updateLayouts(nextLayouts: GridLayouts, maxRows: number, strictBreakpoint?: DashboardBreakpoint) {
    setDashboard((previous) => {
      if (!previous || !currentPage) {
        return previous;
      }

      const pageWidgetIds = new Set(previous.widgets.filter((widget) => widget.pageId === currentPage.id).map((widget) => widget.id));
      const merged = {
        ...previous,
        layouts: mergeLayoutsForPage(previous.layouts, currentPage.id, nextLayouts, pageWidgetIds)
      };

      return sanitizeDashboardDocument(merged, maxRows, strictBreakpoint);
    });
  }

  function applyWidgetRect(
    widgetId: string,
    rect: Pick<GridLayouts[DashboardBreakpoint][number], "x" | "y" | "w" | "h">,
    maxRows: number,
    strictBreakpoint?: DashboardBreakpoint
  ): WidgetRectApplyResult {
    if (!dashboard) {
      return {
        document: buildDefaultDashboardLayout(),
        applied: false,
        reason: "not-found"
      };
    }

    const applyResult = tryApplyWidgetRectOnDashboardDocument(
      dashboard,
      widgetId,
      rect,
      maxRows,
      strictBreakpoint
    );

    setDashboard(applyResult.document);
    return applyResult;
  }

  function repairDashboard(maxRows: number, strictBreakpoint?: DashboardBreakpoint) {
    setDashboard((previous) => (previous ? sanitizeDashboardDocument(previous, maxRows, strictBreakpoint) : previous));
  }

  function addWidget(type: DashboardWidgetType, maxRows: number, strictBreakpoint?: DashboardBreakpoint) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      try {
        return addWidgetToDashboardDocument(previous, type, maxRows, currentPageIndex, strictBreakpoint);
      } catch {
        window.alert("現在の表示サイズでは、このウィジェットを配置できません。");
        return previous;
      }
    });
    setWidgetPickerOpen(false);
  }

  function deleteWidget(widgetId: string, maxRows: number, strictBreakpoint?: DashboardBreakpoint) {
    if (!window.confirm("このウィジェットを削除しますか？")) {
      return;
    }

    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const next = {
        ...previous,
        widgets: previous.widgets.filter((widget) => widget.id !== widgetId),
        layouts: Object.fromEntries(
          BREAKPOINT_KEYS.map((breakpointKey) => [
            breakpointKey,
            previous.layouts[breakpointKey].filter((item) => item.i !== widgetId)
          ])
        ) as DashboardResponsiveLayouts
      };

      return sanitizeDashboardDocument(next, maxRows, strictBreakpoint);
    });
  }

  function clearAllWidgets() {
    if (!window.confirm("すべてのウィジェットを削除しますか？この操作は元に戻せません。")) {
      return;
    }

    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const basePage = previous.pages.find((page) => !page.isDraft) ?? previous.pages[0] ?? createPage(0);
      const pages = [{ ...basePage, title: "Page 1", isDraft: false }];

      return {
        ...previous,
        pages,
        widgets: [],
        layouts: createEmptyLayouts(),
        currentPageId: pages[0].id
      };
    });
  }

  function beginWidgetDrag(widgetId: string) {
    draggingWidgetIdRef.current = widgetId;
  }

  function shiftDraggingWidgetPage(delta: -1 | 1, maxRows: number, strictBreakpoint?: DashboardBreakpoint) {
    const draggingWidgetId = draggingWidgetIdRef.current;
    if (!draggingWidgetId) {
      return;
    }

    pulsePageAnimation(setIsPageAnimating);
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const currentIndex = previous.pages.findIndex((page) => page.id === previous.currentPageId);
      if (currentIndex < 0) {
        return previous;
      }

      let pages = previous.pages;
      let targetIndex = currentIndex + delta;

      if (delta === 1 && currentIndex === pages.length - 1) {
        const currentPageEntry = pages[currentIndex];
        if (currentPageEntry?.isDraft) {
          return previous;
        }

        pages = [...pages, createPage(pages.length, true)];
        targetIndex = pages.length - 1;
      }

      if (targetIndex < 0 || targetIndex >= pages.length) {
        return previous;
      }

      const targetPage = pages[targetIndex];
      if (!targetPage || targetPage.id === previous.currentPageId) {
        return previous;
      }

      const moved = moveWidgetToPageInDashboardDocument(
        {
          ...previous,
          pages
        },
        draggingWidgetId,
        targetPage.id,
        maxRows,
        strictBreakpoint
      );

      return {
        ...moved,
        pages,
        currentPageId: targetPage.id
      };
    });
  }

  function endWidgetDrag(maxRows: number, strictBreakpoint?: DashboardBreakpoint, shouldSanitize = true) {
    draggingWidgetIdRef.current = null;
    if (!shouldSanitize) {
      return;
    }
    setDashboard((previous) => (previous ? sanitizeDashboardDocument(previous, maxRows, strictBreakpoint) : previous));
  }

  return {
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
    applyWidgetRect,
    repairDashboard,
    addWidget,
    deleteWidget,
    clearAllWidgets,
    beginWidgetDrag,
    shiftDraggingWidgetPage,
    endWidgetDrag,
    findWidgetLayout: (widgetId: string, targetBreakpoint: DashboardBreakpoint) =>
      dashboard ? findWidgetLayoutForBreakpoint(dashboard, widgetId, targetBreakpoint) : null
  };
}

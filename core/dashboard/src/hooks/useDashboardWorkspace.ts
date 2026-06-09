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
import type { GridLayouts, SaveState } from "../dashboard/types";
import type { DashboardBreakpoint, DashboardLayoutDocument, DashboardResponsiveLayouts, DashboardWidgetType } from "../types";

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

function widgetCountByPage(document: DashboardLayoutDocument) {
  return document.pages.reduce<Record<string, number>>((accumulator, page) => {
    accumulator[page.id] = document.widgets.filter((widget) => widget.pageId === page.id).length;
    return accumulator;
  }, {});
}

function pruneEmptyPages(document: DashboardLayoutDocument, preferredCurrentPageId?: string): DashboardLayoutDocument {
  const counts = widgetCountByPage(document);
  const nonEmptyPages = document.pages.filter((page) => (counts[page.id] ?? 0) > 0);

  if (nonEmptyPages.length === 0) {
    const basePage = document.pages.find((page) => !page.isDraft) ?? document.pages[0] ?? createPage(0);
    const pages = renumberPages([{ ...basePage, isDraft: false }]);
    return {
      ...document,
      pages,
      widgets: [],
      layouts: Object.fromEntries(BREAKPOINT_KEYS.map((breakpoint) => [breakpoint, []])) as unknown as DashboardResponsiveLayouts,
      currentPageId: pages[0].id
    };
  }

  const pages = renumberPages(nonEmptyPages);
  const pageIds = new Set(pages.map((page) => page.id));
  const originalPages = document.pages;
  const targetPageId =
    (preferredCurrentPageId && pageIds.has(preferredCurrentPageId) && preferredCurrentPageId) ||
    (pageIds.has(document.currentPageId) ? document.currentPageId : null);

  const fallbackPage =
    (targetPageId && pages.find((page) => page.id === targetPageId)) ||
    pages.find((page) => {
      const currentIndex = originalPages.findIndex((candidate) => candidate.id === (preferredCurrentPageId ?? document.currentPageId));
      const candidateIndex = originalPages.findIndex((candidate) => candidate.id === page.id);
      return candidateIndex >= Math.max(0, currentIndex);
    }) ||
    pages[0];

  return {
    ...document,
    pages,
    widgets: document.widgets.filter((widget) => pageIds.has(widget.pageId)),
    layouts: Object.fromEntries(
      BREAKPOINT_KEYS.map((breakpoint) => [
        breakpoint,
        document.layouts[breakpoint].filter((item) => pageIds.has(item.pageId) && document.widgets.some((widget) => widget.id === item.i))
      ])
    ) as DashboardResponsiveLayouts,
    currentPageId: fallbackPage.id
  };
}

function moveWidgetToPage(document: DashboardLayoutDocument, widgetId: string, targetPageId: string): DashboardLayoutDocument {
  const widget = document.widgets.find((candidate) => candidate.id === widgetId);
  if (!widget || widget.pageId === targetPageId) {
    return document;
  }

  const widgets = document.widgets.map((candidate) =>
    candidate.id === widgetId ? { ...candidate, pageId: targetPageId } : candidate
  );

  const layouts = Object.fromEntries(
    BREAKPOINT_KEYS.map((breakpoint) => {
      const pageItems = document.layouts[breakpoint].filter((item) => item.pageId === targetPageId && item.i !== widgetId);
      const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);

      return [
        breakpoint,
        document.layouts[breakpoint].map((item) =>
          item.i === widgetId
            ? {
                ...item,
                pageId: targetPageId,
                x: 0,
                y: bottomY
              }
            : item
        )
      ];
    })
  ) as DashboardResponsiveLayouts;

  return {
    ...document,
    widgets,
    layouts,
    pages: document.pages.map((page) => (page.id === targetPageId ? { ...page, isDraft: false } : page)),
    currentPageId: targetPageId
  };
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

    pulsePageAnimation(setIsPageAnimating);
    setDashboard((previous) => (previous ? { ...previous, currentPageId: nextPage.id } : previous));
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

  function addWidget(type: DashboardWidgetType) {
    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      const targetPageId = previous.currentPageId;
      const widget = widgetPreset(type, targetPageId);
      const nextLayouts = cloneResponsiveLayouts(previous.layouts);

      for (const breakpointKey of BREAKPOINT_KEYS) {
        const pageItems = nextLayouts[breakpointKey].filter((item) => item.pageId === targetPageId);
        const bottomY = pageItems.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        nextLayouts[breakpointKey].push(layoutPreset(widget, breakpointKey, bottomY));
      }

      return {
        ...previous,
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

      return pruneEmptyPages(next);
    });
  }

  function beginWidgetDrag(widgetId: string) {
    draggingWidgetIdRef.current = widgetId;
  }

  function shiftDraggingWidgetPage(delta: -1 | 1) {
    if (!draggingWidgetIdRef.current) {
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

        pages = renumberPages([...pages, createPage(pages.length, true)]);
        targetIndex = pages.length - 1;
      }

      if (targetIndex < 0 || targetIndex >= pages.length) {
        return previous;
      }

      const targetPage = pages[targetIndex];
      if (!targetPage || targetPage.id === previous.currentPageId) {
        return previous;
      }

      return {
        ...previous,
        pages,
        currentPageId: targetPage.id
      };
    });
  }

  function endWidgetDrag() {
    const draggingWidgetId = draggingWidgetIdRef.current;
    draggingWidgetIdRef.current = null;

    setDashboard((previous) => {
      if (!previous) {
        return previous;
      }

      let next = previous;
      if (draggingWidgetId) {
        next = moveWidgetToPage(next, draggingWidgetId, next.currentPageId);
      }

      return pruneEmptyPages(next, next.currentPageId);
    });
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
    addWidget,
    deleteWidget,
    beginWidgetDrag,
    shiftDraggingWidgetPage,
    endWidgetDrag
  };
}

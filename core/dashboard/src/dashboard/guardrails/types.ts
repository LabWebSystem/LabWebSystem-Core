import type {
  DashboardBreakpoint,
  DashboardLayoutDocument,
  DashboardLayoutItem,
  DashboardResponsiveLayouts,
  DashboardWidget,
  DashboardWidgetType
} from "../../types";
import type { WidgetSizing } from "../types";

export type DashboardStructureViolationCode =
  | "duplicate_page_id"
  | "duplicate_widget_id"
  | "layout_without_widget"
  | "duplicate_layout_item"
  | "widget_without_page"
  | "layout_without_page";

export type DashboardGeometryViolationCode =
  | "out_of_bounds"
  | "overlap"
  | "size_constraint_mismatch"
  | "page_overflow";

export type DashboardStructureViolation = {
  code: DashboardStructureViolationCode;
  detail: string;
  pageId?: string;
  widgetId?: string;
  breakpoint?: DashboardBreakpoint;
};

export type DashboardGeometryViolation = {
  code: DashboardGeometryViolationCode;
  detail: string;
  breakpoint: DashboardBreakpoint;
  pageId?: string;
  widgetId?: string;
  relatedWidgetId?: string;
};

export type DashboardGuardrailReport = {
  structureViolations: DashboardStructureViolation[];
  geometryViolations: DashboardGeometryViolation[];
};

export type DashboardPlacement = Record<DashboardBreakpoint, { x: number; y: number }>;

export type DashboardWidgetSizes = Record<DashboardBreakpoint, WidgetSizing>;

export type DashboardLayoutItemLike = Pick<DashboardLayoutItem, "x" | "y" | "w" | "h">;

export type DashboardWidgetSortContext = {
  pageOrder: Map<string, number>;
  layoutOrder: Map<string, { y: number; x: number }>;
};

export type DashboardLayoutFactory = {
  createPage: (index: number) => { id: string; title: string; isDraft: boolean };
  ensureWidgetsHaveLayouts: (document: DashboardLayoutDocument) => DashboardLayoutDocument;
  renumberPages: (pages: Array<{ id: string; title: string; isDraft?: boolean }>) => Array<{ id: string; title: string; isDraft: boolean }>;
};

export type DashboardSanitizeContext = DashboardLayoutFactory & {
  document: DashboardLayoutDocument;
  maxRows: number;
  strictBreakpoint?: DashboardBreakpoint;
};

export type DashboardStructureValidationContext = {
  document: DashboardLayoutDocument;
};

export type DashboardGeometryValidationContext = {
  document: DashboardLayoutDocument;
  maxRows: number;
  strictBreakpoint?: DashboardBreakpoint;
};

export type DashboardPlacementContext = {
  layouts: DashboardResponsiveLayouts;
  pageId: string;
  type: DashboardWidgetType;
  maxRows: number;
  strictBreakpoint?: DashboardBreakpoint;
};

export type DashboardSizedPlacementContext = {
  layouts: DashboardResponsiveLayouts;
  pageId: string;
  sizes: DashboardWidgetSizes;
  maxRows: number;
  excludeWidgetId?: string;
  strictBreakpoint?: DashboardBreakpoint;
};

export type DashboardSizedLayoutItemContext = {
  widget: DashboardWidget;
  pageId: string;
  breakpoint: DashboardBreakpoint;
  size: WidgetSizing;
  position: { x: number; y: number };
};

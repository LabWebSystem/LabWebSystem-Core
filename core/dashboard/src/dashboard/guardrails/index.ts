export { sanitizeDashboardDocument, inspectDashboardGuardrails } from "./document";
export { findPlacementForSizedWidget, findPlacementForWidget, findAvailablePosition, fitsWithinBounds, intersects, validateDashboardGeometry } from "./geometry";
export { coerceWidgetSizing, widgetSizesForDocument } from "./sizing";
export { validateDashboardStructure } from "./structure";
export type {
  DashboardGeometryViolation,
  DashboardGeometryViolationCode,
  DashboardGuardrailReport,
  DashboardPlacement,
  DashboardStructureViolation,
  DashboardStructureViolationCode,
  DashboardWidgetSizes
} from "./types";

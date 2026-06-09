import type { DashboardBreakpoint } from "../types";
import type { GridLayouts } from "./types";

export const DASHBOARD_ID = "operations-monitoring";
export const USER_ID = "default";
export const BREAKPOINTS = { lg: 1200, md: 960, sm: 720, xs: 0 } as const;
export const BREAKPOINT_KEYS = Object.keys(BREAKPOINTS) as DashboardBreakpoint[];
export const COLS = { lg: 12, md: 10, sm: 6, xs: 4 } as const;
export const ROW_HEIGHT = 48;
export const GRID_MARGIN: [number, number] = [12, 12];
export const CONTAINER_PADDING: [number, number] = [16, 16];
export const HISTORY_LIMIT = 24;
export const PAGE_ANIMATION_MS = 420;
export const EMPTY_GRID_LAYOUTS: GridLayouts = { lg: [], md: [], sm: [], xs: [] };

export type WidgetId = string;
export type PageIndex = number;

export type DashboardMode = 'edit' | 'view' | 'locked';

export type CollisionMode = 'reject' | 'make-room-free' | 'make-room-adjacent';

export type PageAxis = 'horizontal' | 'vertical';

export type WidgetViewMode = 'icon' | 'compact' | 'summary' | 'full';

export type WidgetShape = 'square' | 'wide' | 'tall';

export type WidgetControlType = 'delete' | 'resize' | 'drag' | 'menu' | 'duplicate' | 'lock';

export type WidgetControlAnchor =
  | 'inside-top-left'
  | 'inside-top-right'
  | 'inside-bottom-left'
  | 'inside-bottom-right'
  | 'outside-top-left'
  | 'outside-top-right'
  | 'outside-bottom-left'
  | 'outside-bottom-right'
  | 'edge-top-left'
  | 'edge-top-right'
  | 'edge-bottom-left'
  | 'edge-bottom-right';

export type WidgetControlVisibility =
  | 'always'
  | 'hover'
  | 'edit-mode'
  | 'selected'
  | 'hover-or-selected'
  | 'edit-mode-and-hover';

export interface GridConfig {
  readonly cols: number;
  readonly rows: number;
}

export interface GridRenderConfig extends GridConfig {
  readonly gapPx: number;
  readonly paddingPx: number;
}

export interface WidgetSizeConstraint {
  readonly defaultW: number;
  readonly defaultH: number;
  readonly minW: number;
  readonly minH: number;
  readonly maxW: number;
  readonly maxH: number;
}

export interface Rect {
  readonly page: PageIndex;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PointerInput {
  readonly clientX: number;
  readonly clientY: number;
  readonly timeMs?: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DashboardViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SquareGridMetrics {
  readonly cellSizePx: number;
  readonly gapPx: number;
  readonly paddingPx: number;
  readonly gridLeftPx: number;
  readonly gridTopPx: number;
  readonly gridWidthPx: number;
  readonly gridHeightPx: number;
}

export interface WidgetLayout extends Rect {
  readonly id: WidgetId;
  readonly type: string;
  readonly minW: number;
  readonly minH: number;
  readonly maxW: number;
  readonly maxH: number;
  readonly locked?: boolean;
  readonly draggable?: boolean;
  readonly resizable?: boolean;
}

export interface WidgetTemplate {
  readonly id: WidgetId;
  readonly type: string;
  readonly page?: PageIndex;
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly minW: number;
  readonly minH: number;
  readonly maxW: number;
  readonly maxH: number;
  readonly locked?: boolean;
  readonly draggable?: boolean;
  readonly resizable?: boolean;
}

export interface DraftPageState {
  readonly page: PageIndex;
  readonly source: 'drag';
}

export interface LayoutState {
  readonly grid: GridConfig;
  readonly mode: DashboardMode;
  readonly collisionMode: CollisionMode;
  readonly widgets: readonly WidgetLayout[];
  readonly pageCount: number;
  readonly draftPage: DraftPageState | null;
}

export interface CreateLayoutStateInput {
  readonly grid: GridConfig;
  readonly widgets?: readonly WidgetLayout[];
  readonly mode?: DashboardMode;
  readonly collisionMode?: CollisionMode;
  readonly draftPage?: DraftPageState | null;
}

export interface WidgetDisplayCapabilities {
  readonly canShowTitle: boolean;
  readonly canShowSubtitle: boolean;
  readonly canShowBody: boolean;
  readonly canShowDetails: boolean;
  readonly canShowActions: boolean;
}

export interface WidgetDisplayContext {
  readonly viewMode: WidgetViewMode;
  readonly shape: WidgetShape;
  readonly capabilities: WidgetDisplayCapabilities;
}

export interface PlaceholderState extends Rect {
  readonly valid: boolean;
  readonly reason?: string;
}

export type PlacementStatus = 'accepted' | 'rejected';

export interface DisplacementStep {
  readonly id: WidgetId;
  readonly from: Rect;
  readonly to: Rect;
  readonly reason: 'free-space' | 'adjacent-push' | 'moving-widget';
}

export interface DisplacementPlan {
  readonly mode: CollisionMode;
  readonly signature: string;
  readonly steps: readonly DisplacementStep[];
}

export interface PlacementResult {
  readonly status: PlacementStatus;
  readonly state: LayoutState;
  readonly placeholder: PlaceholderState;
  readonly plan: DisplacementPlan | null;
  readonly reason?: string;
}

export interface PageSwitchPolicy {
  /** ページ切替はページ内側の端ではなく、外側へ出た距離で判定する。 */
  readonly outsideThresholdPx: number;
  /** 同じ方向への連続切替を抑止する時間。 */
  readonly cooldownMs: number;
  readonly axis: PageAxis;
}

export interface DragSession {
  readonly widgetId: WidgetId;
  readonly sourceRect: Rect;
  readonly grabOffsetPx: Point;
  readonly currentPage: PageIndex;
  readonly candidateRect: Rect;
  readonly startedAtMs: number;
  readonly lastPageSwitchAtMs: number | null;
}

export interface DragUpdateInput {
  readonly pointer: PointerInput;
  readonly dashboardViewport: DashboardViewport;
  readonly metrics: SquareGridMetrics;
  readonly policy?: Partial<PageSwitchPolicy>;
}

export interface DragUpdateResult {
  readonly session: DragSession;
  readonly candidateRect: Rect;
  readonly ghostRectPx: PixelRect;
  readonly draftPage: DraftPageState | null;
  readonly pageSwitch: 'none' | 'previous' | 'next' | 'draft-next';
}

export interface ResolvePlacementOptions {
  readonly collisionMode?: CollisionMode;
  readonly directionHint?: Direction;
}

export type Direction = 'right' | 'up' | 'left' | 'down';

export interface WidgetRenderer<Data = unknown> {
  (data: Data, context: WidgetDisplayContext): unknown;
}

export interface WidgetRendererSet<Data = unknown> {
  readonly icon: WidgetRenderer<Data>;
  readonly compact?: WidgetRenderer<Data>;
  readonly summary?: WidgetRenderer<Data>;
  readonly full?: WidgetRenderer<Data>;
}

export interface WidgetDefinition<Data = unknown> {
  readonly type: string;
  readonly title: string;
  readonly size: WidgetSizeConstraint;
  readonly render: WidgetRendererSet<Data>;
  readonly defaultData?: Data;
  readonly resolveViewMode?: (w: number, h: number) => WidgetViewMode;
}

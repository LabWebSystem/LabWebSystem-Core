import { assertNever } from "./assert";
import type {
  WidgetDisplayCapabilities,
  WidgetDisplayContext,
  WidgetRenderer,
  WidgetRendererSet,
  WidgetShape,
  WidgetViewMode
} from "./types";

export function resolveWidgetViewMode(w: number, h: number): WidgetViewMode {
  const area = w * h;
  const minSide = Math.min(w, h);

  if (w === 1 && h === 1) return 'icon';
  if (area <= 3 || minSide === 1) return 'compact';
  if (area < 9) return 'summary';
  return 'full';
}

export function resolveWidgetShape(w: number, h: number): WidgetShape {
  if (w === h) return 'square';
  if (w > h) return 'wide';
  return 'tall';
}

export function capabilitiesForViewMode(viewMode: WidgetViewMode): WidgetDisplayCapabilities {
  switch (viewMode) {
    case 'icon':
      return {
        canShowTitle: false,
        canShowSubtitle: false,
        canShowBody: false,
        canShowDetails: false,
        canShowActions: false
      };
    case 'compact':
      return {
        canShowTitle: true,
        canShowSubtitle: false,
        canShowBody: false,
        canShowDetails: false,
        canShowActions: false
      };
    case 'summary':
      return {
        canShowTitle: true,
        canShowSubtitle: true,
        canShowBody: true,
        canShowDetails: false,
        canShowActions: false
      };
    case 'full':
      return {
        canShowTitle: true,
        canShowSubtitle: true,
        canShowBody: true,
        canShowDetails: true,
        canShowActions: true
      };
    default:
      return assertNever(viewMode);
  }
}

export function createWidgetDisplayContext(w: number, h: number): WidgetDisplayContext {
  const viewMode = resolveWidgetViewMode(w, h);
  return {
    viewMode,
    shape: resolveWidgetShape(w, h),
    capabilities: capabilitiesForViewMode(viewMode)
  };
}

export function resolveRenderer<Data>(
  renderers: WidgetRendererSet<Data>,
  requestedViewMode: WidgetViewMode
): WidgetRenderer<Data> {
  switch (requestedViewMode) {
    case 'full':
      return renderers.full ?? renderers.summary ?? renderers.compact ?? renderers.icon;
    case 'summary':
      return renderers.summary ?? renderers.compact ?? renderers.icon;
    case 'compact':
      return renderers.compact ?? renderers.icon;
    case 'icon':
      return renderers.icon;
    default:
      return assertNever(requestedViewMode);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = clamp(Math.floor(Math.log(bytes) / Math.log(1024)), 0, units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function gaugeTone(value: number): string {
  if (value >= 85) {
    return "bg-rose-500";
  }
  if (value >= 65) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
}

export function findScrollableAncestor(target: EventTarget | null, boundary: HTMLElement | null): HTMLElement | null {
  if (!(target instanceof HTMLElement) || !boundary) {
    return null;
  }

  let element: HTMLElement | null = target;
  while (element && element !== boundary) {
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    const isScrollable =
      element.dataset.widgetScrollable === "true" ||
      ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight + 2);

    if (isScrollable) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

export function canScrollInside(element: HTMLElement, deltaY: number): boolean {
  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 2;
  }
  if (deltaY < 0) {
    return element.scrollTop > 2;
  }
  return false;
}

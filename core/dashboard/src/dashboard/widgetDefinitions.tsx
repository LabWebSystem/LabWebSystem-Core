import type { ReactNode } from "react";
import {
  FaChartLine,
  FaCircleExclamation,
  FaDatabase,
  FaEthernet,
  FaHardDrive,
  FaMemory,
  FaMicrochip
} from "react-icons/fa6";
import type { DashboardBreakpoint, DashboardWidgetType } from "../types";
import { createWidgetDisplayContext } from "./gridModule/display";
import type { GridItemLayout, WidgetDefinition, WidgetSizing, WidgetVisualMode } from "./types";

export const WIDGET_ORDER: DashboardWidgetType[] = [
  "status",
  "cpu",
  "memory",
  "disk",
  "network",
  "chart",
  "alert",
  "applications",
  "jobs",
  "events",
  "log"
];

export const WIDGET_DEFINITIONS: Record<DashboardWidgetType, WidgetDefinition> = {
  status: {
    label: "ステータスカード",
    description: "主要な稼働数値をまとめて俯瞰します。",
    icon: FaChartLine,
    sizes: {
      lg: { w: 12, h: 4, minW: 6, minH: 3 },
      md: { w: 10, h: 4, minW: 6, minH: 3 },
      sm: { w: 6, h: 4, minW: 4, minH: 3 },
      xs: { w: 4, h: 4, minW: 4, minH: 3 }
    }
  },
  cpu: {
    label: "CPU使用率",
    description: "CPU の使用率と負荷傾向を表示します。",
    icon: FaMicrochip,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  memory: {
    label: "メモリ使用率",
    description: "メモリ使用量と総量のバランスを追います。",
    icon: FaMemory,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  disk: {
    label: "ディスク使用率",
    description: "ストレージ消費と残容量を確認します。",
    icon: FaHardDrive,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  network: {
    label: "ネットワーク状況",
    description: "IP / DNS / インターフェース状況を確認します。",
    icon: FaEthernet,
    sizes: {
      lg: { w: 3, h: 4, minW: 2, minH: 3 },
      md: { w: 5, h: 4, minW: 3, minH: 3 },
      sm: { w: 3, h: 4, minW: 2, minH: 3 },
      xs: { w: 4, h: 4, minW: 2, minH: 3 }
    }
  },
  chart: {
    label: "グラフ表示",
    description: "CPU / Memory / Disk の推移を比較します。",
    icon: FaChartLine,
    sizes: {
      lg: { w: 6, h: 5, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  alert: {
    label: "アラート一覧",
    description: "警告や異常を優先して流し見できます。",
    icon: FaCircleExclamation,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  applications: {
    label: "アプリ一覧",
    description: "アプリの健全性と詳細画面導線を並べます。",
    icon: FaDatabase,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  jobs: {
    label: "ジョブ一覧",
    description: "直近ジョブの状態とメッセージを監視します。",
    icon: FaChartLine,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  events: {
    label: "イベント一覧",
    description: "イベントログを時系列で確認します。",
    icon: FaCircleExclamation,
    sizes: {
      lg: { w: 6, h: 6, minW: 4, minH: 4 },
      md: { w: 10, h: 5, minW: 5, minH: 4 },
      sm: { w: 6, h: 5, minW: 4, minH: 4 },
      xs: { w: 4, h: 5, minW: 3, minH: 4 }
    }
  },
  log: {
    label: "ログ一覧",
    description: "アプリログをサービス単位で追跡します。",
    icon: FaDatabase,
    sizes: {
      lg: { w: 12, h: 7, minW: 6, minH: 4 },
      md: { w: 10, h: 6, minW: 5, minH: 4 },
      sm: { w: 6, h: 6, minW: 4, minH: 4 },
      xs: { w: 4, h: 6, minW: 3, minH: 4 }
    }
  }
};

export function widgetDefinition(type: DashboardWidgetType): WidgetDefinition {
  return WIDGET_DEFINITIONS[type];
}

export function widgetLabel(type: DashboardWidgetType): string {
  return widgetDefinition(type).label;
}

export function widgetIcon(type: DashboardWidgetType, className = "text-xl"): ReactNode {
  const Icon = widgetDefinition(type).icon;
  return <Icon className={className} />;
}

export function widgetSizing(type: DashboardWidgetType, breakpoint: DashboardBreakpoint): WidgetSizing {
  return widgetDefinition(type).sizes[breakpoint];
}

export function formatGridSize(w: number, h: number): string {
  return `${w}×${h}`;
}

export function modeLabel(mode: WidgetVisualMode): string {
  switch (mode) {
    case "compact":
      return "縮小";
    case "detail":
      return "詳細";
    default:
      return "標準";
  }
}

export function pageBadgeLabel(index: number): string {
  return `page ${index + 1}`;
}

export function resolveWidgetMode(type: DashboardWidgetType, layout: GridItemLayout | null): WidgetVisualMode {
  if (!layout) {
    return "standard";
  }

  const { viewMode } = createWidgetDisplayContext(layout.w, layout.h);

  switch (viewMode) {
    case "icon":
    case "compact":
      return "compact";
    case "summary":
      return "standard";
    case "full":
      return "detail";
    default:
      return "standard";
  }
}

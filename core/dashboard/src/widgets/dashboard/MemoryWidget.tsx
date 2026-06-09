import { MetricWidget } from "./MetricWidget";
import { WidgetFrame } from "./WidgetFrame";
import { formatBytes } from "../../dashboard/utils";
import { widgetIcon } from "../../dashboard/widgetDefinitions";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { DashboardMetrics } from "../../types";

export function MemoryWidget(props: { frameProps: DashboardWidgetFrameProps; metrics: DashboardMetrics | null }) {
  const { frameProps, metrics } = props;
  return (
    <WidgetFrame {...frameProps}>
      <MetricWidget
        icon={widgetIcon("memory")}
        value={metrics?.memory.usagePercent ?? 0}
        label="メモリ使用率"
        meta={`${formatBytes(metrics?.memory.usedBytes ?? 0)} / ${formatBytes(metrics?.memory.totalBytes ?? 0)}`}
        mode={frameProps.mode}
        detailItems={[
          `used ${formatBytes(metrics?.memory.usedBytes ?? 0)}`,
          `free ${formatBytes(metrics?.memory.freeBytes ?? 0)}`,
          `total ${formatBytes(metrics?.memory.totalBytes ?? 0)}`
        ]}
      />
    </WidgetFrame>
  );
}

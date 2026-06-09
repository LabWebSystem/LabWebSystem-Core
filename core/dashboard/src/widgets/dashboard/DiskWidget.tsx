import { MetricWidget } from "./MetricWidget";
import { WidgetFrame } from "./WidgetFrame";
import { formatBytes } from "../../dashboard/utils";
import { widgetIcon } from "../../dashboard/widgetDefinitions";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { DashboardMetrics } from "../../types";

export function DiskWidget(props: { frameProps: DashboardWidgetFrameProps; metrics: DashboardMetrics | null }) {
  const { frameProps, metrics } = props;
  return (
    <WidgetFrame {...frameProps}>
      <MetricWidget
        icon={widgetIcon("disk")}
        value={metrics?.disk.usagePercent ?? 0}
        label="ディスク使用率"
        meta={`${formatBytes(metrics?.disk.usedBytes ?? 0)} / ${formatBytes(metrics?.disk.totalBytes ?? 0)}`}
        mode={frameProps.mode}
        detailItems={[
          `path ${metrics?.disk.path ?? "/"}`,
          `free ${formatBytes(metrics?.disk.freeBytes ?? 0)}`,
          `total ${formatBytes(metrics?.disk.totalBytes ?? 0)}`
        ]}
      />
    </WidgetFrame>
  );
}

import { MetricWidget } from "./MetricWidget";
import { WidgetFrame } from "./WidgetFrame";
import { widgetIcon } from "../../dashboard/widgetDefinitions";
import type { DashboardWidgetFrameProps } from "../../dashboard/types";
import type { DashboardMetrics } from "../../types";

export function CpuWidget(props: { frameProps: DashboardWidgetFrameProps; metrics: DashboardMetrics | null }) {
  const { frameProps, metrics } = props;
  return (
    <WidgetFrame {...frameProps}>
      <MetricWidget
        icon={widgetIcon("cpu")}
        value={metrics?.cpu.usagePercent ?? 0}
        label="CPU使用率"
        meta={`load avg ${metrics?.cpu.loadAverage1m ?? 0} / ${metrics?.cpu.coreCount ?? 0} cores`}
        mode={frameProps.mode}
        detailItems={[
          `1m ${metrics?.cpu.loadAverage1m ?? 0}`,
          `5m ${metrics?.cpu.loadAverage5m ?? 0}`,
          `15m ${metrics?.cpu.loadAverage15m ?? 0}`,
          `cores ${metrics?.cpu.coreCount ?? 0}`
        ]}
      />
    </WidgetFrame>
  );
}

import { useEffect, useState } from "react";
import { fetchDashboardMetrics } from "../api";
import { HISTORY_LIMIT } from "../dashboard/constants";
import type { MetricsHistory } from "../dashboard/types";
import type { DashboardMetrics } from "../types";

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistory[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function refreshMetrics() {
      try {
        const nextMetrics = await fetchDashboardMetrics();
        if (cancelled) {
          return;
        }

        setMetrics(nextMetrics);
        setMetricsHistory((previous) => {
          const next = [
            ...previous,
            {
              label: new Date(nextMetrics.generatedAt).toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit"
              }),
              cpu: nextMetrics.cpu.usagePercent,
              memory: nextMetrics.memory.usagePercent,
              disk: nextMetrics.disk.usagePercent
            }
          ];

          return next.slice(-HISTORY_LIMIT);
        });
      } catch {
        // UI polling failure is non-fatal.
      }
    }

    void refreshMetrics();
    const intervalId = window.setInterval(() => {
      void refreshMetrics();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    metrics,
    metricsHistory
  };
}

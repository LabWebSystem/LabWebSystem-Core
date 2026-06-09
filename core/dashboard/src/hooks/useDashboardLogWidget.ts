import { useEffect, useMemo, useState } from "react";
import { fetchApplicationLogServices, fetchApplicationLogs } from "../api";
import type { LogWidgetState } from "../dashboard/types";
import type { ApplicationListItem } from "../types";

const INITIAL_LOG_WIDGET: LogWidgetState = {
  applicationId: null,
  services: [],
  selectedService: "",
  lines: [],
  fetchedAt: "",
  loading: false
};

export function useDashboardLogWidget(applications: ApplicationListItem[]) {
  const [logWidget, setLogWidget] = useState<LogWidgetState>(INITIAL_LOG_WIDGET);

  const logSourceOptions = useMemo(
    () => applications.filter((application) => application.status === "Running" || application.health?.severity !== "critical"),
    [applications]
  );

  useEffect(() => {
    const fallbackAppId = logSourceOptions[0]?.application_id ?? null;
    if (!logWidget.applicationId && fallbackAppId) {
      setLogWidget((previous) => ({ ...previous, applicationId: fallbackAppId }));
    }
  }, [logSourceOptions, logWidget.applicationId]);

  useEffect(() => {
    if (!logWidget.applicationId) {
      return;
    }

    let cancelled = false;

    async function refreshLogs() {
      const applicationId = logWidget.applicationId;
      if (!applicationId) {
        return;
      }

      setLogWidget((previous) => ({ ...previous, loading: true }));

      try {
        const services = await fetchApplicationLogServices(applicationId);
        const preferredService = services.includes(logWidget.selectedService)
          ? logWidget.selectedService
          : (services[0] ?? "");
        const response = await fetchApplicationLogs(applicationId, {
          service: preferredService || undefined,
          tail: 120
        });

        if (cancelled) {
          return;
        }

        setLogWidget((previous) => ({
          ...previous,
          services,
          selectedService: preferredService,
          lines: response.lines,
          fetchedAt: response.fetchedAt,
          loading: false
        }));
      } catch {
        if (cancelled) {
          return;
        }
        setLogWidget((previous) => ({ ...previous, loading: false }));
      }
    }

    void refreshLogs();
    const intervalId = window.setInterval(() => {
      void refreshLogs();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [logWidget.applicationId, logWidget.selectedService]);

  return {
    logWidget,
    logSourceOptions,
    setApplicationId: (applicationId: string | null) =>
      setLogWidget((previous) => ({
        ...previous,
        applicationId,
        selectedService: ""
      })),
    setSelectedService: (service: string) =>
      setLogWidget((previous) => ({
        ...previous,
        selectedService: service
      }))
  };
}

export function resolveDeviceMode(envOverrides: Record<string, string>, requiredDeviceCount: number): "real" | "mock" {
  const raw = (envOverrides.LABCORE_DEVICE_MODE ?? "").trim().toLowerCase();
  if (raw === "real" || raw === "mock") {
    return raw;
  }
  return requiredDeviceCount > 0 ? "real" : "mock";
}

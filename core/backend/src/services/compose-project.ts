function normalizeComposeSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[-_]+$/, "");
}

function trimComposeProjectName(value: string): string {
  return value.slice(0, 63).replace(/[-_]+$/, "");
}

export function sanitizeComposeProjectName(
  value: string,
  fallback = "labcore-app"
): string {
  const normalized = trimComposeProjectName(normalizeComposeSegment(value));

  if (normalized.length > 0) {
    return normalized;
  }

  const normalizedFallback = trimComposeProjectName(
    normalizeComposeSegment(fallback)
  );

  return normalizedFallback.length > 0 ? normalizedFallback : "labcore-app";
}

export function buildLegacyComposeProjectName(applicationName: string): string {
  return sanitizeComposeProjectName(applicationName);
}

export function buildComposeProjectName(
  applicationId: string,
  applicationName: string
): string {
  const baseName = buildLegacyComposeProjectName(applicationName);
  const normalizedId = sanitizeComposeProjectName(applicationId, "").slice(0, 8);

  if (normalizedId.length === 0) {
    return baseName;
  }

  return (
    trimComposeProjectName(`${baseName}-${normalizedId}`) ||
    sanitizeComposeProjectName(`labcore-${normalizedId}`)
  );
}

export function resolveComposeProjectName(
  applicationId: string,
  applicationName: string,
  storedProjectName?: string | null
): string {
  const normalizedStored = sanitizeComposeProjectName(storedProjectName ?? "", "");

  if (normalizedStored.length > 0) {
    return normalizedStored;
  }

  return buildComposeProjectName(applicationId, applicationName);
}
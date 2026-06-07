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

export function buildLegacyComposeProjectName(applicationName: string): string {
  const normalizedName = normalizeComposeSegment(applicationName);
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  return "labcore-app";
}

export function buildComposeProjectName(applicationId: string, applicationName: string): string {
  const baseName = buildLegacyComposeProjectName(applicationName);
  const normalizedId = normalizeComposeSegment(applicationId).slice(0, 8);

  if (normalizedId.length === 0) {
    return baseName;
  }

  const candidate = `${baseName}-${normalizedId}`;
  return candidate.slice(0, 63).replace(/[-_]+$/, "") || `labcore-${normalizedId}`;
}

export function resolveComposeProjectName(
  applicationId: string,
  applicationName: string,
  storedProjectName?: string | null
): string {
  const normalizedStored = storedProjectName?.trim();
  if (normalizedStored) {
    return normalizedStored;
  }

  return buildLegacyComposeProjectName(applicationName) || buildComposeProjectName(applicationId, applicationName);
}

import type { ComposeInspectionResult } from "./compose-inspector.js";

export function collectRequiredEnvironmentVariables(result: ComposeInspectionResult): string[] {
  return result.environmentRequirements
    .filter((requirement) => requirement.required)
    .map((requirement) => requirement.name)
    .sort((a, b) => a.localeCompare(b));
}

export function collectOptionalEnvironmentVariables(result: ComposeInspectionResult): Array<{ name: string; defaultValue: string | null }> {
  return result.environmentRequirements
    .filter((requirement) => !requirement.required)
    .map((requirement) => ({ name: requirement.name, defaultValue: requirement.defaultValue }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

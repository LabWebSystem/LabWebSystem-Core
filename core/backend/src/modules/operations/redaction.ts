const REDACTED = "********";
const MAX_LOG_LINE_LENGTH = 8 * 1024;

export type RedactionContext = {
  secretValues?: string[];
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAll(input: string, pattern: RegExp, replacer: string | ((substring: string, ...args: string[]) => string)): string {
  return input.replace(pattern, replacer as never);
}

function normalizeSecretValues(secretValues: string[] | undefined): string[] {
  return [...new Set((secretValues ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}

export function redactText(input: string, context: RedactionContext = {}): string {
  let value = input;

  value = replaceAll(value, /Authorization:\s*(Bearer|Basic)\s+[^\s]+/gi, (_match, scheme: string) => {
    return `Authorization: ${scheme} ${REDACTED}`;
  });
  value = replaceAll(value, /\b(token|password|secret|api_key)=([^&\s]+)/gi, (_match, key: string) => `${key}=${REDACTED}`);
  value = replaceAll(
    value,
    /(^|[\s"'])([A-Za-z0-9_]*(?:TOKEN|PASSWORD|SECRET|API_KEY|AUTHORIZATION)[A-Za-z0-9_]*)=([^\s"']+)/gim,
    (_match, prefix: string, key: string) => `${prefix}${key}=${REDACTED}`
  );
  value = replaceAll(value, /(https?:\/\/)([^/\s:@]+):([^@/\s]+)@/gi, (_match, protocol: string) => `${protocol}${REDACTED}:${REDACTED}@`);

  for (const secretValue of normalizeSecretValues(context.secretValues)) {
    value = replaceAll(value, new RegExp(escapeRegex(secretValue), "g"), REDACTED);
  }

  if (value.length <= MAX_LOG_LINE_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_LINE_LENGTH)}…`;
}

function normalizeJsonValue(value: unknown, context: RedactionContext): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return redactText(value, context);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry, context));
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeJsonValue(entry, context)]));
  }
  return redactText(String(value), context);
}

export function redactJsonRecord(value: Record<string, unknown> | null | undefined, context: RedactionContext = {}) {
  if (!value) {
    return null;
  }

  return normalizeJsonValue(value, context) as Record<string, unknown>;
}

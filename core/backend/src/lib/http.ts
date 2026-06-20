import { nanoid } from "nanoid";
import type { Context, MiddlewareHandler } from "hono";

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  c.set("requestId", nanoid());
  await next();
};

function resolveRequestId(c: Context): string {
  const requestId = c.get("requestId");
  return typeof requestId === "string" && requestId.length > 0 ? requestId : nanoid();
}

export function jsonError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown> | null
) {
  return c.json(
    {
      error: {
        code,
        message,
        details: details ?? null,
        requestId: resolveRequestId(c)
      }
    },
    status as never
  );
}

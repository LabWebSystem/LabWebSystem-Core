import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { jsonError, requestIdMiddleware } from "../../lib/http.js";
import { OperationNotFoundError, OperationStateError } from "./operation-errors.js";
import type { OperationService } from "./operation.service.js";
import { isTerminalOperationStatus } from "./operation-types.js";

type CreateOperationsApiRouterOptions = {
  operationService: OperationService;
};

function parseNumberQuery(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createOperationsApiRouter(options: CreateOperationsApiRouterOptions) {
  const router = new Hono();
  router.use("*", requestIdMiddleware);

  router.get("/:operationId", async (c) => {
    const operationId = c.req.param("operationId");
    try {
      const detail = await options.operationService.getOperationDetail(operationId);
      return c.json(detail);
    } catch (error) {
      if (error instanceof OperationNotFoundError) {
        return jsonError(c, 404, error.code, error.message, { operationId });
      }
      const message = error instanceof Error ? error.message : "Failed to load operation.";
      return jsonError(c, 500, "OPERATION_LOAD_FAILED", message, { operationId });
    }
  });

  router.post("/:operationId/cancel", async (c) => {
    const operationId = c.req.param("operationId");
    try {
      const cancelled = await options.operationService.cancelOperation(operationId);
      return c.json(cancelled, 202);
    } catch (error) {
      if (error instanceof OperationNotFoundError) {
        return jsonError(c, 404, error.code, error.message, { operationId });
      }
      if (error instanceof OperationStateError) {
        return jsonError(c, 409, error.code, error.message, error.details ?? { operationId });
      }
      const message = error instanceof Error ? error.message : "Failed to cancel operation.";
      return jsonError(c, 500, "OPERATION_CANCEL_FAILED", message, { operationId });
    }
  });

  router.post("/:operationId/retry", async (c) => {
    const operationId = c.req.param("operationId");
    try {
      const retried = await options.operationService.retryOperation(operationId);
      return c.json(retried, 202);
    } catch (error) {
      if (error instanceof OperationNotFoundError) {
        return jsonError(c, 404, error.code, error.message, { operationId });
      }
      if (error instanceof OperationStateError) {
        return jsonError(c, 409, error.code, error.message, error.details ?? { operationId });
      }
      const message = error instanceof Error ? error.message : "Failed to retry operation.";
      return jsonError(c, 500, "OPERATION_RETRY_FAILED", message, { operationId });
    }
  });

  router.get("/:operationId/logs", async (c) => {
    const operationId = c.req.param("operationId");
    const after = parseNumberQuery(c.req.query("after"));
    const limit = parseNumberQuery(c.req.query("limit"));
    const tail = parseNumberQuery(c.req.query("tail"));
    const stepId = c.req.query("stepId") ?? null;

    try {
      const logs = await options.operationService.listOperationLogs({
        operationId,
        after,
        limit,
        tail,
        stepId
      });
      return c.json(logs);
    } catch (error) {
      if (error instanceof OperationNotFoundError) {
        return jsonError(c, 404, error.code, error.message, { operationId });
      }
      const message = error instanceof Error ? error.message : "Failed to load operation logs.";
      return jsonError(c, 500, "OPERATION_LOGS_LOAD_FAILED", message, { operationId });
    }
  });

  router.get("/:operationId/logs/stream", async (c) => {
    const operationId = c.req.param("operationId");
    const detail = options.operationService.getOperationDetailOrNull(operationId);
    if (!detail) {
      return jsonError(c, 404, "OPERATION_NOT_FOUND", "Operation not found.", { operationId });
    }

    return streamSSE(c, async (stream) => {
      if (isTerminalOperationStatus(detail.status)) {
        await stream.writeSSE({
          event: "operation",
          data: JSON.stringify(detail)
        });
        return;
      }

      const unsubscribe = options.operationService.eventBus.subscribe(operationId, async (event) => {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event.payload)
        });
      });

      const heartbeat = setInterval(async () => {
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({
            operationId,
            timestamp: new Date().toISOString()
          })
        });
      }, 30_000);

      try {
        await stream.onAbort(() => {
          clearInterval(heartbeat);
          unsubscribe();
        });
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    });
  });

  return router;
}

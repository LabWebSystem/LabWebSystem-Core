import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { jsonError, requestIdMiddleware } from "../../lib/http.js";
import { OperationNotFoundError, OperationStateError } from "./operation-errors.js";
import { isTerminalOperationStatus } from "./operation-types.js";
import type { OperationService } from "./operation.service.js";

type CreateOperationsApiRouterOptions = {
  operationService: OperationService;
};

const DEFAULT_LOG_STREAM_TAIL = 200;
const LOG_STREAM_HEARTBEAT_INTERVAL_MS = 30_000;

function parseNumberQuery(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTail(value: number | null): number {
  if (value === null) {
    return DEFAULT_LOG_STREAM_TAIL;
  }

  return Math.min(Math.max(1, value), 1000);
}

function shouldDebugLogStream(debugQuery: string | undefined): boolean {
  return debugQuery === "1" || process.env.LAB_CORE_LOG_STREAM_DEBUG === "1";
}

function logStreamDebug(enabled: boolean, message: string, payload: Record<string, unknown>) {
  if (!enabled) {
    return;
  }

  console.info(`[operation-log-stream] ${message}`, payload);
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
    const tail = normalizeTail(parseNumberQuery(c.req.query("tail")));
    const debug = shouldDebugLogStream(c.req.query("debug"));
    const streamConnectionId = randomUUID();

    const detail = options.operationService.getOperationDetailOrNull(operationId);
    if (!detail) {
      logStreamDebug(debug, "not-found", {
        streamConnectionId,
        operationId
      });

      return jsonError(c, 404, "OPERATION_NOT_FOUND", "Operation not found.", { operationId });
    }

    logStreamDebug(debug, "open", {
      streamConnectionId,
      operationId,
      applicationId: detail.applicationId,
      type: detail.type,
      status: detail.status,
      tail,
      terminalAtOpen: isTerminalOperationStatus(detail.status),
      openedAt: new Date().toISOString()
    });

    return streamSSE(c, async (stream) => {
      let aborted = false;
      let terminal = isTerminalOperationStatus(detail.status);
      let unsubscribe: (() => void) | null = null;
      let writeQueue = Promise.resolve();
      let eventCount = 0;
      let heartbeatCount = 0;

      const writeEvent = (event: string, payload: unknown) => {
        eventCount += 1;

        logStreamDebug(debug, "write-event", {
          streamConnectionId,
          operationId,
          event,
          eventCount,
          aborted,
          terminal,
          writtenAt: new Date().toISOString()
        });

        writeQueue = writeQueue
          .then(() =>
            stream.writeSSE({
              event,
              data: JSON.stringify(payload)
            })
          )
          .catch((error) => {
            aborted = true;

            logStreamDebug(debug, "write-error", {
              streamConnectionId,
              operationId,
              event,
              error: error instanceof Error ? error.message : String(error),
              failedAt: new Date().toISOString()
            });
          });

        return writeQueue;
      };

      stream.onAbort(() => {
        aborted = true;
        unsubscribe?.();
        unsubscribe = null;

        logStreamDebug(debug, "abort", {
          streamConnectionId,
          operationId,
          eventCount,
          heartbeatCount,
          abortedAt: new Date().toISOString()
        });
      });

      if (!terminal) {
        unsubscribe = options.operationService.eventBus.subscribe(operationId, (event) => {
          if (aborted) {
            logStreamDebug(debug, "bus-event-skipped-after-abort", {
              streamConnectionId,
              operationId,
              eventType: event.type,
              skippedAt: new Date().toISOString()
            });

            return;
          }

          if (event.type === "operation" && isTerminalOperationStatus(event.payload.status)) {
            terminal = true;
          }

          logStreamDebug(debug, "bus-event", {
            streamConnectionId,
            operationId,
            eventType: event.type,
            terminal,
            receivedAt: new Date().toISOString()
          });

          void writeEvent(event.type, event.payload);
        });

        logStreamDebug(debug, "subscribed", {
          streamConnectionId,
          operationId,
          subscribedAt: new Date().toISOString()
        });
      } else {
        logStreamDebug(debug, "skip-subscribe-terminal-operation", {
          streamConnectionId,
          operationId,
          status: detail.status
        });
      }

      try {
        const logs = await options.operationService.listOperationLogs({
          operationId,
          after: null,
          limit: null,
          tail,
          stepId: null
        });

        const latestDetail = options.operationService.getOperationDetailOrNull(operationId) ?? detail;

        logStreamDebug(debug, "snapshot", {
          streamConnectionId,
          operationId,
          status: latestDetail.status,
          logCount: logs.items.length,
          nextAfter: logs.nextAfter,
          logsAvailable: logs.logsAvailable,
          hasMore: logs.hasMore,
          timestamp: new Date().toISOString()
        });

        await writeEvent("snapshot", {
          operation: latestDetail,
          logs: logs.items,
          nextAfter: logs.nextAfter,
          logsAvailable: logs.logsAvailable,
          timestamp: new Date().toISOString()
        });

        if (isTerminalOperationStatus(latestDetail.status)) {
          terminal = true;

          logStreamDebug(debug, "terminal-after-snapshot", {
            streamConnectionId,
            operationId,
            status: latestDetail.status,
            eventCount,
            timestamp: new Date().toISOString()
          });

          await writeEvent("operation", latestDetail);
          await writeQueue;
          return;
        }

        while (!aborted && !terminal) {
          await stream.sleep(LOG_STREAM_HEARTBEAT_INTERVAL_MS);

          if (!aborted) {
            heartbeatCount += 1;

            logStreamDebug(debug, "heartbeat", {
              streamConnectionId,
              operationId,
              heartbeatCount,
              eventCount,
              timestamp: new Date().toISOString()
            });

            await writeEvent("heartbeat", {
              operationId,
              streamConnectionId,
              timestamp: new Date().toISOString()
            });
          }
        }

        await writeQueue;
      } finally {
        aborted = true;
        unsubscribe?.();
        unsubscribe = null;

        logStreamDebug(debug, "close", {
          streamConnectionId,
          operationId,
          terminal,
          eventCount,
          heartbeatCount,
          closedAt: new Date().toISOString()
        });
      }
    });
  });

  return router;
}
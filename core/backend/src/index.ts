import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db, nowIso } from "./lib/db.js";
import { env } from "./lib/env.js";
import { requestIdMiddleware } from "./lib/http.js";
import { createApplicationsApiRouter } from "./modules/applications/application.routes.js";
import { recordSystemEvent } from "./modules/events/event.repository.js";
import { InMemoryOperationEventBus } from "./modules/operations/operation-events.js";
import { OperationLogRepository } from "./modules/operations/operation-log.repository.js";
import { OperationRunner } from "./modules/operations/operation-runner.js";
import { createOperationsApiRouter } from "./modules/operations/operation.routes.js";
import { OperationService } from "./modules/operations/operation.service.js";
import { getOpenApiDocument, getOpenApiYaml } from "./openapi.js";
import { eventsRouter } from "./routes/events.js";
import { infrastructureRouter } from "./routes/infrastructure.js";
import { systemRouter } from "./routes/system.js";
import { testingRouter } from "./routes/testing.js";
import { dnsServer } from "./services/dns-server.js";
import { recordEvent } from "./services/events.js";
import { syncInfrastructure } from "./services/infrastructure-sync.js";

const app = new Hono();

const operationEventBus = new InMemoryOperationEventBus();

const operationRunner = new OperationRunner({
  db,
  eventBus: operationEventBus,
  syncInfrastructure
});

const operationService = new OperationService({
  db,
  eventBus: operationEventBus,
  autoStart: true,
  scheduleOperation: (operationId) => {
    void operationRunner.executeOperation(operationId).catch((error) => {
      const message =
        error instanceof Error ? error.message : "Operation execution failed.";

      recordSystemEvent(db, {
        scope: "operation",
        level: "error",
        title: "Operation 実行中に未捕捉エラーが発生しました",
        message,
        createdAt: nowIso()
      });

      // eslint-disable-next-line no-console
      console.error(`[operation-runner] ${operationId}: ${message}`);
    });
  }
});

const operationLogRepository = new OperationLogRepository(db);

app.use("*", logger());
app.use("/api/*", cors());
app.use("/api/*", requestIdMiddleware);

app.get("/health", (c) => {
  return c.json({
    ok: true,
    timestamp: nowIso()
  });
});

app.route(
  "/api/applications",
  createApplicationsApiRouter({
    db,
    operationService
  })
);

app.route(
  "/api/operations",
  createOperationsApiRouter({
    operationService
  })
);

app.route("/api/system", systemRouter);
app.route("/api/events", eventsRouter);
app.route("/api/infrastructure", infrastructureRouter);
app.route("/api/testing", testingRouter);

app.get("/api", (c) => {
  return c.json({
    service: "lab-core-backend",
    version: "0.1.0",
    timestamp: nowIso(),
    openapi: {
      jsonUrl: "/api/openapi.json",
      yamlUrl: "/api/openapi.yaml"
    }
  });
});

app.get("/api/openapi.json", (c) => {
  return c.json(getOpenApiDocument());
});

app.get("/api/openapi.yaml", (c) => {
  return c.body(getOpenApiYaml(), 200, {
    "content-type": "application/yaml; charset=utf-8"
  });
});

const currentEventCount = Number(
  (
    db
      .prepare("SELECT COUNT(*) as count FROM system_events")
      .get() as { count: number } | undefined
  )?.count ?? 0
);

if (currentEventCount === 0) {
  recordEvent({
    scope: "system",
    level: "info",
    title: "Lab-Core v3 を初期化しました",
    message: "バックエンドが初回起動しました。"
  });
}

const interruptedOperations =
  await operationService.markIncompleteOperationsAsInterrupted();

if (interruptedOperations.length > 0) {
  recordSystemEvent(db, {
    scope: "system",
    level: "warning",
    title: "未完了 Operation を整理しました",
    message: `起動時に ${interruptedOperations.length} 件の未完了 Operation を interrupted へ更新しました。`,
    createdAt: nowIso()
  });
}

const logRetentionCutoff = new Date(
  Date.now() - 30 * 24 * 60 * 60 * 1000
).toISOString();

const deletedLogCount =
  operationLogRepository.deleteLogsForCompletedOperationsBefore(
    logRetentionCutoff
  );

if (deletedLogCount > 0) {
  recordSystemEvent(db, {
    scope: "system",
    level: "info",
    title: "古い Operation Log を整理しました",
    message: `${deletedLogCount} 件の completed operation の log を削除しました。`,
    createdAt: nowIso()
  });
}

void dnsServer.start();

try {
  syncInfrastructure("backend-startup");
} catch (error) {
  const message = error instanceof Error ? error.message : "不明なエラー";

  recordEvent({
    scope: "infrastructure",
    level: "warning",
    title: "起動時の DNS/Proxy 同期に失敗しました",
    message
  });
}

serve(
  {
    fetch: app.fetch,
    port: env.port
  },
  () => {
    // eslint-disable-next-line no-console
    console.log(`[lab-core-backend] listening on :${env.port}`);
  }
);
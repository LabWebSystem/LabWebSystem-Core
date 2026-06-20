import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { ZodError } from "zod";
import { env } from "../../lib/env.js";
import { jsonError, requestIdMiddleware } from "../../lib/http.js";
import { assessApplicationHealth } from "../../services/application-health.js";
import { listApplicationServices, readApplicationLogs } from "../../services/application-logs.js";
import {
  buildFallbackServiceCandidate,
  buildUnavailableComposeInspection,
  collectRepositoryMetadataFromPaths,
  inspectComposeYaml,
  listLocalRepositoryFiles
} from "../../services/compose-inspection.js";
import { recordSystemEvent } from "../events/event.repository.js";
import { ApplicationRepository } from "./application.repository.js";
import { createApplicationSchema, updateApplicationSchema, updateDeploymentSchema } from "./application.schemas.js";
import { OperationConflictError, OperationStateError } from "../operations/operation-errors.js";
import { parseCreateOperationRequest } from "../operations/operation-schemas.js";
import type { OperationService } from "../operations/operation.service.js";

type CreateApplicationsApiRouterOptions = {
  db: Database.Database;
  operationService: OperationService;
};

function removedOperationEndpointMessage(endpoint: string): string {
  return `The legacy endpoint ${endpoint} has been removed. Use /api/applications/{applicationId}/operations or /api/operations/{operationId} instead.`;
}

export function createApplicationsApiRouter(options: CreateApplicationsApiRouterOptions) {
  const router = new Hono();
  const repository = new ApplicationRepository(options.db);
  router.use("*", requestIdMiddleware);

  router.get("/", async (c) => {
    const applications = repository.listApplications();
    const items = await Promise.all(
      applications.map(async (application) => {
        const containers = options.db
          .prepare(
            `
              SELECT health_state
              FROM container_instances
              WHERE application_id = ?
            `
          )
          .all(String(application.application_id)) as Array<{ health_state: string }>;

        const health = await assessApplicationHealth({
          status: String(application.status),
          hostname: typeof application.hostname === "string" ? application.hostname : null,
          enabled: Boolean(application.enabled),
          containers
        });

        return {
          ...application,
          health
        };
      })
    );

    return c.json({ applications: items });
  });

  router.post("/", async (c) => {
    const payload = await c.req.json().catch(() => null);
    if (!payload) {
      return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    try {
      const parsed = createApplicationSchema.parse(payload);
      const createdAt = new Date().toISOString();
      const created = repository.createApplication(parsed, createdAt);
      recordSystemEvent(options.db, {
        scope: "application",
        applicationId: created.applicationId,
        level: "info",
        title: "アプリを登録しました",
        message: `アプリ ${parsed.name} を登録しました。`,
        createdAt
      });

      return c.json(
        {
          ...created,
          message: "Application registered. Create a deploy operation to start runtime changes."
        },
        201
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return jsonError(c, 400, "INVALID_APPLICATION_REQUEST", "Application request is invalid.", {
          issues: error.issues
        });
      }

      const message = error instanceof Error ? error.message : "Failed to create application.";
      if (message.includes("UNIQUE")) {
        return jsonError(c, 409, "APPLICATION_DUPLICATE", "Application name or hostname is already in use.");
      }
      return jsonError(c, 500, "APPLICATION_CREATE_FAILED", message);
    }
  });

  router.get("/:applicationId", async (c) => {
    const applicationId = c.req.param("applicationId");
    const detail = repository.getApplicationDetail(applicationId);
    if (!detail) {
      return jsonError(c, 404, "APPLICATION_NOT_FOUND", "Application not found.", { applicationId });
    }

    const deployment = detail.deployment;
    const health = await assessApplicationHealth({
      status: String(detail.application.status),
      hostname: deployment && typeof deployment.hostname === "string" ? deployment.hostname : null,
      enabled: deployment ? Boolean(deployment.enabled) : false,
      containers: detail.containers as Array<{ health_state: string }>
    });

    let composeInspection = null;
    if (deployment && typeof detail.application.name === "string" && typeof deployment.compose_path === "string") {
      const repoPath = path.join(env.appsRoot, detail.application.name);
      const selectedComposePath = deployment.compose_path;
      const fallbackServices = [
        buildFallbackServiceCandidate(String(deployment.public_service_name), Number(deployment.public_port))
      ];

      if (!fs.existsSync(repoPath)) {
        composeInspection = buildUnavailableComposeInspection({
          selectedComposePath,
          source: {
            kind: "local",
            path: selectedComposePath,
            absolutePath: path.join(repoPath, selectedComposePath)
          },
          message: `ローカルリポジトリが見つかりません: ${repoPath}`,
          fallbackServices
        });
      } else {
        const metadata = collectRepositoryMetadataFromPaths(listLocalRepositoryFiles(repoPath));
        const absolutePath = path.resolve(repoPath, selectedComposePath);
        if (!fs.existsSync(absolutePath)) {
          composeInspection = buildUnavailableComposeInspection({
            composeCandidates: metadata.composeCandidates,
            yamlFiles: metadata.yamlFiles,
            recommendedComposePath: metadata.recommendedComposePath,
            selectedComposePath,
            source: {
              kind: "local",
              path: selectedComposePath,
              absolutePath
            },
            message: `compose ファイルが見つかりません: ${selectedComposePath}`,
            fallbackServices
          });
        } else {
          composeInspection = inspectComposeYaml({
            rawYaml: fs.readFileSync(absolutePath, "utf8"),
            composeCandidates: metadata.composeCandidates,
            yamlFiles: metadata.yamlFiles,
            recommendedComposePath: metadata.recommendedComposePath,
            selectedComposePath,
            source: {
              kind: "local",
              path: selectedComposePath,
              absolutePath
            }
          });
        }
      }
    }

    const operations = await options.operationService.listOperationsByApplicationId(applicationId, 40).catch(() => []);

    return c.json({
      application: detail.application,
      deployment: detail.deployment,
      health,
      composeInspection,
      routes: detail.routes,
      containers: detail.containers,
      updateInfo: detail.updateInfo,
      events: detail.events,
      operations
    });
  });

  router.patch("/:applicationId", async (c) => {
    const applicationId = c.req.param("applicationId");
    const payload = await c.req.json().catch(() => null);
    if (!payload) {
      return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    try {
      const parsed = updateApplicationSchema.parse(payload);
      repository.updateApplication(applicationId, parsed, new Date().toISOString());
      const detail = repository.getApplicationDetail(applicationId);
      return c.json(detail);
    } catch (error) {
      if (error instanceof ZodError) {
        return jsonError(c, 400, "INVALID_APPLICATION_PATCH", "Application patch is invalid.", {
          issues: error.issues
        });
      }

      const message = error instanceof Error ? error.message : "Failed to update application.";
      if (message === "Application not found.") {
        return jsonError(c, 404, "APPLICATION_NOT_FOUND", message, { applicationId });
      }
      if (message.includes("UNIQUE")) {
        return jsonError(c, 409, "APPLICATION_DUPLICATE", "Application name is already in use.");
      }
      return jsonError(c, 500, "APPLICATION_UPDATE_FAILED", message, { applicationId });
    }
  });

  router.get("/:applicationId/deployment", (c) => {
    const applicationId = c.req.param("applicationId");
    const deployment = repository.getDeployment(applicationId);
    if (!deployment) {
      return jsonError(c, 404, "DEPLOYMENT_NOT_FOUND", "Deployment not found.", { applicationId });
    }
    return c.json(deployment);
  });

  router.get("/:applicationId/deployment/inspection", (c) => {
    const applicationId = c.req.param("applicationId");
    const detail = repository.getApplicationDetail(applicationId);
    if (!detail || !detail.deployment || typeof detail.application.name !== "string") {
      return jsonError(c, 404, "APPLICATION_NOT_FOUND", "Application not found.", { applicationId });
    }

    const requestedComposePath = c.req.query("composePath") ?? String(detail.deployment.compose_path);
    const repoPath = path.join(env.appsRoot, detail.application.name);
    const fallbackServices = [
      buildFallbackServiceCandidate(String(detail.deployment.public_service_name), Number(detail.deployment.public_port))
    ];
    if (!fs.existsSync(repoPath)) {
      return c.json(
        buildUnavailableComposeInspection({
          selectedComposePath: requestedComposePath,
          source: {
            kind: "local",
            path: requestedComposePath,
            absolutePath: path.join(repoPath, requestedComposePath)
          },
          message: `ローカルリポジトリが見つかりません: ${repoPath}`,
          fallbackServices
        })
      );
    }

    const metadata = collectRepositoryMetadataFromPaths(listLocalRepositoryFiles(repoPath));
    const absolutePath = path.resolve(repoPath, requestedComposePath);
    if (!fs.existsSync(absolutePath)) {
      return c.json(
        buildUnavailableComposeInspection({
          composeCandidates: metadata.composeCandidates,
          yamlFiles: metadata.yamlFiles,
          recommendedComposePath: metadata.recommendedComposePath,
          selectedComposePath: requestedComposePath,
          source: {
            kind: "local",
            path: requestedComposePath,
            absolutePath
          },
          message: `compose ファイルが見つかりません: ${requestedComposePath}`,
          fallbackServices
        })
      );
    }

    return c.json(
      inspectComposeYaml({
        rawYaml: fs.readFileSync(absolutePath, "utf8"),
        composeCandidates: metadata.composeCandidates,
        yamlFiles: metadata.yamlFiles,
        recommendedComposePath: metadata.recommendedComposePath,
        selectedComposePath: requestedComposePath,
        source: {
          kind: "local",
          path: requestedComposePath,
          absolutePath
        }
      })
    );
  });

  router.patch("/:applicationId/deployment", async (c) => {
    const applicationId = c.req.param("applicationId");
    const payload = await c.req.json().catch(() => null);
    if (!payload) {
      return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    try {
      const parsed = updateDeploymentSchema.parse(payload);
      repository.updateDeployment(applicationId, {
        composePath: parsed.composePath,
        publicServiceName: parsed.publicServiceName,
        publicPort: parsed.publicPort,
        hostname: parsed.hostname,
        keepVolumesOnRebuild: parsed.keepVolumesOnRebuild ?? true,
        envOverrides: parsed.envOverrides
      });
      const detail = repository.getApplicationDetail(applicationId);
      return c.json(detail);
    } catch (error) {
      if (error instanceof ZodError) {
        return jsonError(c, 400, "INVALID_DEPLOYMENT_PATCH", "Deployment patch is invalid.", {
          issues: error.issues
        });
      }

      const message = error instanceof Error ? error.message : "Failed to update deployment.";
      if (message === "Deployment not found." || message === "Application not found.") {
        return jsonError(c, 404, "APPLICATION_NOT_FOUND", message, { applicationId });
      }
      if (message.includes("UNIQUE")) {
        return jsonError(c, 409, "DEPLOYMENT_DUPLICATE", "Deployment hostname is already in use.");
      }
      return jsonError(c, 500, "DEPLOYMENT_UPDATE_FAILED", message, { applicationId });
    }
  });

  router.get("/:applicationId/runtime-logs", async (c) => {
    const applicationId = c.req.param("applicationId");
    const service = c.req.query("service");
    const tail = Number(c.req.query("tail") ?? 200);

    try {
      const snapshot = await readApplicationLogs(applicationId, {
        service: service && service.length > 0 ? service : undefined,
        tail: Number.isFinite(tail) ? Math.min(Math.max(tail, 20), 1000) : 200
      });
      const services = await listApplicationServices(applicationId);
      return c.json({
        ...snapshot,
        services
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load runtime logs.";
      if (message.includes("見つかりません")) {
        return jsonError(c, 404, "RUNTIME_LOG_TARGET_NOT_FOUND", message, { applicationId });
      }
      return jsonError(c, 500, "RUNTIME_LOGS_LOAD_FAILED", message, { applicationId });
    }
  });

  router.post("/:applicationId/operations", async (c) => {
    const applicationId = c.req.param("applicationId");
    const payload = await c.req.json().catch(() => null);
    if (!payload) {
      return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    try {
      const parsed = parseCreateOperationRequest(payload);
      const created = await options.operationService.createOperation({
        applicationId,
        type: parsed.type,
        parameters: parsed.parameters
      });
      return c.json(created, 202);
    } catch (error) {
      if (error instanceof ZodError) {
        return jsonError(c, 400, "INVALID_OPERATION_REQUEST", "Operation request is invalid.", {
          issues: error.issues
        });
      }
      if (error instanceof OperationConflictError) {
        return jsonError(c, 409, error.code, error.message, error.details);
      }
      if (error instanceof OperationStateError) {
        return jsonError(c, 409, error.code, error.message, error.details ?? null);
      }

      const message = error instanceof Error ? error.message : "Failed to create operation.";
      if (message === "Application not found.") {
        return jsonError(c, 404, "APPLICATION_NOT_FOUND", message, { applicationId });
      }

      return jsonError(c, 500, "OPERATION_CREATE_FAILED", message, { applicationId });
    }
  });

  router.get("/:applicationId/operations", async (c) => {
    const applicationId = c.req.param("applicationId");
    const limit = Number(c.req.query("limit") ?? 50);

    try {
      const operations = await options.operationService.listOperationsByApplicationId(applicationId, limit);
      return c.json({ applicationId, operations });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Application not found.";
      if (message === "Application not found.") {
        return jsonError(c, 404, "APPLICATION_NOT_FOUND", message, { applicationId });
      }
      return jsonError(c, 500, "APPLICATION_OPERATIONS_LIST_FAILED", message, { applicationId });
    }
  });

  const removedEndpoints = ["restart", "stop", "resume", "rebuild", "update-check", "update", "rollback"];
  for (const endpoint of removedEndpoints) {
    router.post(`/:applicationId/${endpoint}`, (c) => {
      return jsonError(c, 404, "ENDPOINT_REMOVED", removedOperationEndpointMessage(`/api/applications/{applicationId}/${endpoint}`), {
        replacement: "/api/applications/{applicationId}/operations"
      });
    });
  }

  router.delete("/:applicationId", (c) => {
    return jsonError(c, 404, "ENDPOINT_REMOVED", removedOperationEndpointMessage("/api/applications/{applicationId}"), {
      replacement: "/api/applications/{applicationId}/operations"
    });
  });

  return router;
}

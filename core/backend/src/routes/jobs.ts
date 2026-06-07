import { Hono } from "hono";
import { db } from "../lib/db.js";
import { executeUpdateCheckJob } from "../services/application-update-check.js";
import {
  executeDeleteJob,
  executeDeployJob,
  executeRebuildJob,
  executeResumeJob,
  executeRestartJob,
  executeRollbackJob,
  executeStopJob,
  executeUpdateJob
} from "../services/application-jobs.js";
import { cancelQueuedJob, createJobWithPayload, deleteFinishedJob, getActiveJobForApplication } from "../services/jobs.js";

export const jobsRouter = new Hono();

type JobRow = {
  job_id: string;
  type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  request_payload: string;
  related_application_id: string | null;
  application_name: string | null;
  created_at: string;
};

function parseJobPayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function describeJobType(type: string): string {
  switch (type) {
    case "deploy":
      return "デプロイ";
    case "restart":
      return "再起動";
    case "stop":
      return "停止";
    case "resume":
      return "再開";
    case "rebuild":
      return "再ビルド";
    case "update-check":
      return "更新確認";
    case "update":
      return "更新適用";
    case "rollback":
      return "ロールバック";
    case "delete":
      return "削除";
    default:
      return type;
  }
}

function isDeleteMode(value: unknown): value is "config_only" | "source_and_config" | "full" {
  return value === "config_only" || value === "source_and_config" || value === "full";
}

function dispatchJob(job: JobRow, payload: Record<string, unknown>, nextJobId: string): void {
  const applicationId = job.related_application_id;
  if (!applicationId) {
    return;
  }

  switch (job.type) {
    case "deploy":
      void executeDeployJob(applicationId, nextJobId);
      return;
    case "restart":
      void executeRestartJob(applicationId, nextJobId);
      return;
    case "stop":
      void executeStopJob(applicationId, nextJobId);
      return;
    case "resume":
      void executeResumeJob(applicationId, nextJobId);
      return;
    case "rebuild":
      void executeRebuildJob(applicationId, nextJobId, payload.keepData !== false);
      return;
    case "update-check":
      void executeUpdateCheckJob(applicationId, nextJobId);
      return;
    case "update":
      void executeUpdateJob(applicationId, nextJobId);
      return;
    case "rollback":
      void executeRollbackJob(applicationId, nextJobId);
      return;
    case "delete":
      void executeDeleteJob(applicationId, nextJobId, isDeleteMode(payload.mode) ? payload.mode : "config_only");
      return;
    default:
      return;
  }
}

jobsRouter.get("/", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const jobs = db
    .prepare(
      `
        SELECT
          j.job_id,
          j.type,
          j.status,
          j.started_at,
          j.finished_at,
          j.message,
          j.request_payload,
          j.related_application_id,
          a.name AS application_name,
          j.created_at
        FROM jobs j
        LEFT JOIN applications a ON a.application_id = j.related_application_id
        ORDER BY j.created_at DESC
        LIMIT ?
      `
    )
    .all(limit) as JobRow[];

  return c.json({
    jobs: jobs.map((job) => ({
      ...job,
      request_payload: parseJobPayload(job.request_payload),
      retryable: job.status === "failed" && job.related_application_id !== null,
      cancellable: job.status === "queued",
      dismissible: ["succeeded", "failed", "cancelled"].includes(job.status)
    }))
  });
});

jobsRouter.post("/:jobId/retry", (c) => {
  const jobId = c.req.param("jobId");
  const job = db
    .prepare(
      `
        SELECT
          j.job_id,
          j.type,
          j.status,
          j.started_at,
          j.finished_at,
          j.message,
          j.request_payload,
          j.related_application_id,
          a.name AS application_name,
          j.created_at
        FROM jobs j
        LEFT JOIN applications a ON a.application_id = j.related_application_id
        WHERE j.job_id = ?
      `
    )
    .get(jobId) as JobRow | undefined;

  if (!job) {
    return c.json({ message: "対象ジョブが見つかりません。" }, 404);
  }

  if (job.status !== "failed") {
    return c.json({ message: "失敗したジョブのみ再実行できます。" }, 400);
  }

  if (!job.related_application_id) {
    return c.json({ message: "関連アプリがないため、このジョブは再実行できません。" }, 400);
  }

  const blockingJob = getActiveJobForApplication(job.related_application_id);
  if (blockingJob) {
    const phase = blockingJob.status === "running" ? "実行中" : "実行待ち";
    return c.json(
      {
        message: `現在は ${describeJobType(blockingJob.type)} ジョブが${phase}のため、再実行できません。`,
        activeJob: blockingJob
      },
      409
    );
  }

  const payload = parseJobPayload(job.request_payload);
  const nextJobId = createJobWithPayload(
    job.type as Parameters<typeof createJobWithPayload>[0],
    payload,
    job.related_application_id,
    `${describeJobType(job.type)} ジョブを再実行します。`
  );

  dispatchJob(job, payload, nextJobId);

  return c.json(
    {
      jobId: nextJobId,
      message: `${describeJobType(job.type)} ジョブを再実行しました。`
    },
    202
  );
});

jobsRouter.post("/:jobId/cancel", (c) => {
  const jobId = c.req.param("jobId");
  const job = db
    .prepare(
      `
        SELECT job_id, status
        FROM jobs
        WHERE job_id = ?
      `
    )
    .get(jobId) as { job_id: string; status: string } | undefined;

  if (!job) {
    return c.json({ message: "対象ジョブが見つかりません。" }, 404);
  }

  if (job.status !== "queued") {
    return c.json({ message: "待機中のジョブのみキャンセルできます。" }, 409);
  }

  const cancelled = cancelQueuedJob(jobId);
  if (!cancelled) {
    return c.json({ message: "ジョブをキャンセルできませんでした。既に開始された可能性があります。" }, 409);
  }

  return c.json({
    jobId,
    message: "待機中ジョブをキャンセルしました。"
  });
});

jobsRouter.delete("/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  const job = db
    .prepare(
      `
        SELECT job_id, status
        FROM jobs
        WHERE job_id = ?
      `
    )
    .get(jobId) as { job_id: string; status: string } | undefined;

  if (!job) {
    return c.json({ message: "対象ジョブが見つかりません。" }, 404);
  }

  if (job.status === "queued" || job.status === "running") {
    return c.json({ message: "進行中または待機中のジョブは削除できません。" }, 409);
  }

  const deleted = deleteFinishedJob(jobId);
  if (!deleted) {
    return c.json({ message: "ジョブを削除できませんでした。" }, 409);
  }

  return c.json({
    jobId,
    message: "ジョブをキューから削除しました。"
  });
});

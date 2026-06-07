import { nanoid } from "nanoid";
import { db, nowIso } from "../lib/db.js";
import type { JobStatus, JobType } from "../types.js";

const createJobStatement = db.prepare(`
  INSERT INTO jobs (
    job_id,
    type,
    status,
    started_at,
    finished_at,
    message,
    request_payload,
    related_application_id,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateJobStatusStatement = db.prepare(`
  UPDATE jobs
  SET status = ?, started_at = COALESCE(started_at, ?), finished_at = ?, message = ?
  WHERE job_id = ?
`);

const updateJobMessageStatement = db.prepare(`
  UPDATE jobs
  SET status = 'running', started_at = COALESCE(started_at, ?), message = ?, finished_at = NULL
  WHERE job_id = ?
`);

export function createJob(type: JobType, applicationId?: string, message?: string): string {
  return createJobWithPayload(type, {}, applicationId, message);
}

export function createJobWithPayload(
  type: JobType,
  requestPayload: Record<string, unknown>,
  applicationId?: string,
  message?: string
): string {
  const jobId = nanoid();
  createJobStatement.run(
    jobId,
    type,
    "queued",
    null,
    null,
    message ?? null,
    JSON.stringify(requestPayload),
    applicationId ?? null,
    nowIso()
  );
  return jobId;
}

export function startJob(jobId: string, message?: string): void {
  updateJobStatusStatement.run("running", nowIso(), null, message ?? null, jobId);
}

export function finishJob(jobId: string, status: Extract<JobStatus, "succeeded" | "failed">, message: string): void {
  updateJobStatusStatement.run(status, nowIso(), nowIso(), message, jobId);
}

export function setJobProgress(jobId: string, message: string): void {
  updateJobMessageStatement.run(nowIso(), message, jobId);
}

export type ActiveJobInfo = {
  job_id: string;
  type: JobType;
  status: Extract<JobStatus, "queued" | "running">;
  message: string | null;
  created_at: string;
  started_at: string | null;
};

export function getActiveJobForApplication(applicationId: string): ActiveJobInfo | null {
  const row = db
    .prepare(
      `
        SELECT job_id, type, status, message, created_at, started_at
        FROM jobs
        WHERE related_application_id = ?
          AND status IN ('queued', 'running')
        ORDER BY created_at ASC
        LIMIT 1
      `
    )
    .get(applicationId) as ActiveJobInfo | undefined;

  return row ?? null;
}

export function cancelQueuedJob(jobId: string): boolean {
  const result = db
    .prepare(
      `
        UPDATE jobs
        SET status = 'cancelled',
            finished_at = ?,
            message = ?
        WHERE job_id = ?
          AND status = 'queued'
      `
    )
    .run(nowIso(), "ユーザーが待機中ジョブをキャンセルしました。", jobId);

  return result.changes > 0;
}

export type InterruptedJobInfo = {
  job_id: string;
  type: JobType;
  related_application_id: string | null;
  status: Extract<JobStatus, "queued" | "running">;
};

export function markIncompleteJobsAsInterrupted(): InterruptedJobInfo[] {
  const jobs = db
    .prepare(
      `
        SELECT job_id, type, related_application_id, status
        FROM jobs
        WHERE status IN ('queued', 'running')
        ORDER BY created_at ASC
      `
    )
    .all() as InterruptedJobInfo[];

  if (jobs.length === 0) {
    return [];
  }

  const cancelQueuedStatement = db.prepare(
    `
      UPDATE jobs
      SET status = 'cancelled',
          finished_at = ?,
          message = ?
      WHERE job_id = ?
        AND status = 'queued'
    `
  );

  const failRunningStatement = db.prepare(
    `
      UPDATE jobs
      SET status = 'failed',
          finished_at = ?,
          message = ?
      WHERE job_id = ?
        AND status = 'running'
    `
  );

  const interruptedAt = nowIso();
  const tx = db.transaction((rows: InterruptedJobInfo[]) => {
    for (const job of rows) {
      if (job.status === "queued") {
        cancelQueuedStatement.run(interruptedAt, "バックエンド再起動により待機中ジョブを取り消しました。", job.job_id);
        continue;
      }

      failRunningStatement.run(interruptedAt, "バックエンド再起動により実行中ジョブを中断扱いにしました。", job.job_id);
    }
  });

  tx(jobs);
  return jobs;
}

export function deleteFinishedJob(jobId: string): boolean {
  const result = db
    .prepare(
      `
        DELETE FROM jobs
        WHERE job_id = ?
          AND status IN ('succeeded', 'failed', 'cancelled')
      `
    )
    .run(jobId);

  return result.changes > 0;
}

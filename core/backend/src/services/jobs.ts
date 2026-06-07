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

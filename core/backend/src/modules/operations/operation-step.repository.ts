import { nanoid } from "nanoid";
import type Database from "better-sqlite3";
import type { OperationStepDto, OperationStepStatus } from "./operation-types.js";

type OperationStepRow = {
  step_id: string;
  operation_id: string;
  step_order: number;
  name: string;
  status: OperationStepStatus;
  started_at: string | null;
  updated_at: string;
  finished_at: string | null;
  message: string | null;
  error_code: string | null;
  details: string | null;
};

function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toJsonText(value: Record<string, unknown> | null | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

function mapStepRow(row: OperationStepRow): OperationStepDto {
  return {
    stepId: row.step_id,
    operationId: row.operation_id,
    stepOrder: row.step_order,
    name: row.name,
    status: row.status,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
    message: row.message,
    errorCode: row.error_code,
    details: parseJsonRecord(row.details)
  };
}

export class OperationStepRepository {
  constructor(private readonly db: Database.Database) {}

  createInitialSteps(operationId: string, stepNames: string[], timestamp: string): OperationStepDto[] {
    const insertStatement = this.db.prepare(`
      INSERT INTO operation_steps (
        step_id,
        operation_id,
        step_order,
        name,
        status,
        started_at,
        updated_at,
        finished_at,
        message,
        error_code,
        details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stepNames.map((stepName, index) => {
      const stepId = nanoid();
      insertStatement.run(stepId, operationId, index + 1, stepName, "pending", null, timestamp, null, null, null, null);
      return {
        stepId,
        operationId,
        stepOrder: index + 1,
        name: stepName,
        status: "pending",
        startedAt: null,
        updatedAt: timestamp,
        finishedAt: null,
        message: null,
        errorCode: null,
        details: null
      };
    });
  }

  listByOperationId(operationId: string): OperationStepDto[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            step_id,
            operation_id,
            step_order,
            name,
            status,
            started_at,
            updated_at,
            finished_at,
            message,
            error_code,
            details
          FROM operation_steps
          WHERE operation_id = ?
          ORDER BY step_order ASC
        `
      )
      .all(operationId) as OperationStepRow[];

    return rows.map((row) => mapStepRow(row));
  }

  getById(stepId: string): OperationStepDto | null {
    const row = this.db
      .prepare(
        `
          SELECT
            step_id,
            operation_id,
            step_order,
            name,
            status,
            started_at,
            updated_at,
            finished_at,
            message,
            error_code,
            details
          FROM operation_steps
          WHERE step_id = ?
        `
      )
      .get(stepId) as OperationStepRow | undefined;

    return row ? mapStepRow(row) : null;
  }

  getByOperationAndOrder(operationId: string, stepOrder: number): OperationStepDto | null {
    const row = this.db
      .prepare(
        `
          SELECT
            step_id,
            operation_id,
            step_order,
            name,
            status,
            started_at,
            updated_at,
            finished_at,
            message,
            error_code,
            details
          FROM operation_steps
          WHERE operation_id = ?
            AND step_order = ?
        `
      )
      .get(operationId, stepOrder) as OperationStepRow | undefined;

    return row ? mapStepRow(row) : null;
  }

  updateStep(
    stepId: string,
    input: {
      status: OperationStepStatus;
      updatedAt: string;
      startedAt?: string | null;
      finishedAt?: string | null;
      message?: string | null;
      errorCode?: string | null;
      details?: Record<string, unknown> | null;
    }
  ): OperationStepDto {
    this.db.prepare(
      `
        UPDATE operation_steps
        SET status = ?,
            started_at = COALESCE(?, started_at),
            updated_at = ?,
            finished_at = ?,
            message = ?,
            error_code = ?,
            details = ?
        WHERE step_id = ?
      `
    ).run(
      input.status,
      input.startedAt ?? null,
      input.updatedAt,
      input.finishedAt ?? null,
      input.message ?? null,
      input.errorCode ?? null,
      toJsonText(input.details),
      stepId
    );

    const step = this.getById(stepId);
    if (!step) {
      throw new Error(`Operation step not found after update: ${stepId}`);
    }
    return step;
  }

  skipPendingSteps(operationId: string, timestamp: string, message: string | null): void {
    this.db.prepare(
      `
        UPDATE operation_steps
        SET status = 'skipped',
            updated_at = ?,
            finished_at = ?,
            message = COALESCE(?, message)
        WHERE operation_id = ?
          AND status = 'pending'
      `
    ).run(timestamp, timestamp, message, operationId);
  }
}

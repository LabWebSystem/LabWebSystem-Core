import { nanoid } from "nanoid";
import type Database from "better-sqlite3";
import { OperationConflictError, OperationNotFoundError, OperationStateError } from "./operation-errors.js";
import { OperationStepRepository } from "./operation-step.repository.js";
import type { OperationDetailDto, OperationDto, OperationErrorDto, OperationParameters, OperationStatus, OperationType } from "./operation-types.js";
import {
  buildInitialStepNames,
  buildOperationLinks,
  canCancelOperation,
  canRetryOperation
} from "./operation-types.js";

type OperationRow = {
  operation_id: string;
  application_id: string;
  type: OperationType;
  status: OperationStatus;
  current_step_id: string | null;
  current_step_name: string | null;
  current_step_order: number | null;
  parameters: string;
  result: string | null;
  error_code: string | null;
  error_message: string | null;
  error_details: string | null;
  retry_of_operation_id: string | null;
  logs_available: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type ActiveOperationRow = {
  operation_id: string;
  type: OperationType;
  status: Extract<OperationStatus, "queued" | "running">;
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

function mapOperationRow(row: OperationRow): OperationDto {
  const error: OperationErrorDto | null =
    row.error_code || row.error_message
      ? {
          code: row.error_code ?? "OPERATION_FAILED",
          message: row.error_message ?? "Operation failed.",
          details: parseJsonRecord(row.error_details)
        }
      : null;

  return {
    operationId: row.operation_id,
    applicationId: row.application_id,
    type: row.type,
    status: row.status,
    currentStepId: row.current_step_id,
    currentStepName: row.current_step_name,
    currentStepOrder: row.current_step_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    parameters: parseJsonRecord(row.parameters) ?? {},
    result: parseJsonRecord(row.result),
    error,
    retryOfOperationId: row.retry_of_operation_id,
    logsAvailable: Boolean(row.logs_available),
    canCancel: canCancelOperation(row.status),
    canRetry: canRetryOperation(row.status),
    links: buildOperationLinks(row.operation_id)
  };
}

export class OperationRepository {
  readonly steps: OperationStepRepository;

  constructor(private readonly db: Database.Database) {
    this.steps = new OperationStepRepository(db);
  }

  private getRowById(operationId: string): OperationRow | null {
    const row = this.db
      .prepare(
        `
          SELECT
            operation_id,
            application_id,
            type,
            status,
            current_step_id,
            current_step_name,
            current_step_order,
            parameters,
            result,
            error_code,
            error_message,
            error_details,
            retry_of_operation_id,
            logs_available,
            created_at,
            updated_at,
            started_at,
            finished_at
          FROM operations
          WHERE operation_id = ?
        `
      )
      .get(operationId) as OperationRow | undefined;

    return row ?? null;
  }

  findActiveByApplicationId(applicationId: string): ActiveOperationRow | null {
    const row = this.db
      .prepare(
        `
          SELECT operation_id, type, status
          FROM operations
          WHERE application_id = ?
            AND status IN ('queued', 'running')
          ORDER BY created_at ASC
          LIMIT 1
        `
      )
      .get(applicationId) as ActiveOperationRow | undefined;

    return row ?? null;
  }

  createOperation(input: {
    applicationId: string;
    type: OperationType;
    parameters: OperationParameters;
    timestamp: string;
    retryOfOperationId?: string | null;
  }): OperationDetailDto {
    const runTx = this.db.transaction((txInput: typeof input) => {
      const active = this.findActiveByApplicationId(txInput.applicationId);
      if (active) {
        throw new OperationConflictError("Another operation is already running for this application.", {
          applicationId: txInput.applicationId,
          activeOperationId: active.operation_id
        });
      }

      const operationId = nanoid();
      this.db.prepare(
        `
          INSERT INTO operations (
            operation_id,
            application_id,
            type,
            status,
            current_step_id,
            current_step_name,
            current_step_order,
            parameters,
            result,
            error_code,
            error_message,
            error_details,
            retry_of_operation_id,
            logs_available,
            created_at,
            updated_at,
            started_at,
            finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        operationId,
        txInput.applicationId,
        txInput.type,
        "queued",
        null,
        null,
        null,
        JSON.stringify(txInput.parameters ?? {}),
        null,
        null,
        null,
        null,
        txInput.retryOfOperationId ?? null,
        1,
        txInput.timestamp,
        txInput.timestamp,
        null,
        null
      );

      const steps = this.steps.createInitialSteps(operationId, buildInitialStepNames(txInput.type), txInput.timestamp);
      const row = this.getRowById(operationId);
      if (!row) {
        throw new Error(`Operation not found after insert: ${operationId}`);
      }

      return {
        ...mapOperationRow(row),
        steps
      };
    });

    return runTx.immediate(input);
  }

  listByApplicationId(applicationId: string, limit = 50): OperationDto[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            operation_id,
            application_id,
            type,
            status,
            current_step_id,
            current_step_name,
            current_step_order,
            parameters,
            result,
            error_code,
            error_message,
            error_details,
            retry_of_operation_id,
            logs_available,
            created_at,
            updated_at,
            started_at,
            finished_at
          FROM operations
          WHERE application_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(applicationId, limit) as OperationRow[];

    return rows.map((row) => mapOperationRow(row));
  }

  getDetail(operationId: string): OperationDetailDto {
    const row = this.getRowById(operationId);
    if (!row) {
      throw new OperationNotFoundError();
    }

    return {
      ...mapOperationRow(row),
      steps: this.steps.listByOperationId(operationId)
    };
  }

  getOperation(operationId: string): OperationDto {
    const row = this.getRowById(operationId);
    if (!row) {
      throw new OperationNotFoundError();
    }
    return mapOperationRow(row);
  }

  startOperation(operationId: string, timestamp: string): OperationDto {
    this.db.prepare(
      `
        UPDATE operations
        SET status = 'running',
            started_at = COALESCE(started_at, ?),
            updated_at = ?
        WHERE operation_id = ?
      `
    ).run(timestamp, timestamp, operationId);

    return this.getOperation(operationId);
  }

  setCurrentStep(
    operationId: string,
    input: {
      stepId: string | null;
      stepName: string | null;
      stepOrder: number | null;
      updatedAt: string;
    }
  ): OperationDto {
    this.db.prepare(
      `
        UPDATE operations
        SET current_step_id = ?,
            current_step_name = ?,
            current_step_order = ?,
            updated_at = ?
        WHERE operation_id = ?
      `
    ).run(input.stepId, input.stepName, input.stepOrder, input.updatedAt, operationId);

    return this.getOperation(operationId);
  }

  completeOperation(
    operationId: string,
    input: {
      status: Extract<OperationStatus, "succeeded" | "failed" | "cancelled" | "interrupted">;
      updatedAt: string;
      result?: Record<string, unknown> | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      errorDetails?: Record<string, unknown> | null;
    }
  ): OperationDto {
    this.db.prepare(
      `
        UPDATE operations
        SET status = ?,
            updated_at = ?,
            finished_at = ?,
            result = ?,
            error_code = ?,
            error_message = ?,
            error_details = ?
        WHERE operation_id = ?
      `
    ).run(
      input.status,
      input.updatedAt,
      input.updatedAt,
      toJsonText(input.result),
      input.errorCode ?? null,
      input.errorMessage ?? null,
      toJsonText(input.errorDetails),
      operationId
    );

    return this.getOperation(operationId);
  }

  cancelQueuedOperation(operationId: string, timestamp: string): OperationDetailDto {
    const tx = this.db.transaction((targetOperationId: string) => {
      const row = this.getRowById(targetOperationId);
      if (!row) {
        throw new OperationNotFoundError();
      }
      if (row.status !== "queued") {
        throw new OperationStateError("OPERATION_CANCEL_CONFLICT", "Only queued operations can be cancelled.", {
          operationId: targetOperationId,
          status: row.status
        });
      }

      this.db.prepare(
        `
          UPDATE operations
          SET status = 'cancelled',
              updated_at = ?,
              finished_at = ?,
              result = ?,
              current_step_id = NULL,
              current_step_name = NULL,
              current_step_order = NULL
          WHERE operation_id = ?
        `
      ).run(timestamp, timestamp, JSON.stringify({ message: "Cancelled before execution." }), targetOperationId);

      this.steps.skipPendingSteps(targetOperationId, timestamp, "Cancelled before execution.");
      return this.getDetail(targetOperationId);
    });

    return tx.immediate(operationId);
  }

  markIncompleteAsInterrupted(timestamp: string): OperationDto[] {
    const rows = this.db
      .prepare(
        `
          SELECT operation_id
          FROM operations
          WHERE status IN ('queued', 'running')
          ORDER BY created_at ASC
        `
      )
      .all() as Array<{ operation_id: string }>;

    if (rows.length === 0) {
      return [];
    }

    const tx = this.db.transaction((operationIds: string[]) => {
      const interrupted: OperationDto[] = [];
      for (const operationId of operationIds) {
        this.db.prepare(
          `
            UPDATE operations
            SET status = 'interrupted',
                updated_at = ?,
                finished_at = ?,
                error_code = 'OPERATION_INTERRUPTED',
                error_message = 'Operation was interrupted by backend restart.',
                error_details = ?
            WHERE operation_id = ?
          `
        ).run(timestamp, timestamp, JSON.stringify({ reason: "backend_restart" }), operationId);

        this.steps.skipPendingSteps(operationId, timestamp, "Interrupted by backend restart.");
        interrupted.push(this.getOperation(operationId));
      }
      return interrupted;
    });

    return tx.immediate(rows.map((row) => row.operation_id));
  }

  retryOperation(sourceOperationId: string, timestamp: string): OperationDetailDto {
    const source = this.getOperation(sourceOperationId);
    if (!canRetryOperation(source.status)) {
      throw new OperationStateError("OPERATION_RETRY_CONFLICT", "Only failed or interrupted operations can be retried.", {
        operationId: sourceOperationId,
        status: source.status
      });
    }

    return this.createOperation({
      applicationId: source.applicationId,
      type: source.type,
      parameters: source.parameters,
      timestamp,
      retryOfOperationId: sourceOperationId
    });
  }
}

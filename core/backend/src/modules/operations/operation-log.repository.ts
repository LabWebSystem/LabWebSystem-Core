import type Database from "better-sqlite3";
import type { OperationLogItemDto, OperationLogStream } from "./operation-types.js";

export type OperationLogListResult = {
  operationId: string;
  logsAvailable: boolean;
  items: OperationLogItemDto[];
  nextAfter: number | null;
  hasMore: boolean;
};

type OperationLogRow = {
  operation_id: string;
  sequence: number;
  step_id: string | null;
  stream: OperationLogStream;
  line: string;
  created_at: string;
};

function mapRow(row: OperationLogRow): OperationLogItemDto {
  return {
    operationId: row.operation_id,
    sequence: row.sequence,
    stepId: row.step_id,
    stream: row.stream,
    line: row.line,
    createdAt: row.created_at
  };
}

export class OperationLogRepository {
  private static readonly defaultLimit = 1000;
  private static readonly maxLimit = 1000;
  private static readonly maxTail = 1000;
  private static readonly maxLogLinesPerOperation = 10_000;

  constructor(private readonly db: Database.Database) {}

  getMaxSequence(operationId: string): number {
    const row = this.db
      .prepare("SELECT COALESCE(MAX(sequence), 0) AS max_sequence FROM operation_logs WHERE operation_id = ?")
      .get(operationId) as { max_sequence: number } | undefined;
    return Number(row?.max_sequence ?? 0);
  }

  appendLog(input: {
    operationId: string;
    stepId: string | null;
    sequence: number;
    stream: OperationLogStream;
    line: string;
    createdAt: string;
  }): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM operation_logs WHERE operation_id = ?")
      .get(input.operationId) as { count: number } | undefined;

    if (Number(row?.count ?? 0) >= OperationLogRepository.maxLogLinesPerOperation) {
      return false;
    }

    this.db.prepare(
      `
        INSERT INTO operation_logs (
          operation_id,
          step_id,
          sequence,
          stream,
          line,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(input.operationId, input.stepId, input.sequence, input.stream, input.line, input.createdAt);

    return true;
  }

  listLogs(input: {
    operationId: string;
    logsAvailable: boolean;
    after?: number | null;
    limit?: number | null;
    tail?: number | null;
    stepId?: string | null;
  }): OperationLogListResult {
    if (!input.logsAvailable) {
      return {
        operationId: input.operationId,
        logsAvailable: false,
        items: [],
        nextAfter: null,
        hasMore: false
      };
    }

    const stepWhere = input.stepId ? "AND step_id = ?" : "";
    const stepParameters = input.stepId ? [input.stepId] : [];
    const after = typeof input.after === "number" ? input.after : null;
    const normalizedLimit = Math.min(
      Math.max(1, Number(input.limit ?? OperationLogRepository.defaultLimit)),
      OperationLogRepository.maxLimit
    );
    const normalizedTail = input.tail
      ? Math.min(Math.max(1, Number(input.tail)), OperationLogRepository.maxTail)
      : null;

    if (after !== null) {
      const rows = this.db
        .prepare(
          `
            SELECT operation_id, sequence, step_id, stream, line, created_at
            FROM operation_logs
            WHERE operation_id = ?
              ${stepWhere}
              AND sequence > ?
            ORDER BY sequence ASC
            LIMIT ?
          `
        )
        .all(input.operationId, ...stepParameters, after, normalizedLimit + 1) as OperationLogRow[];

      const hasMore = rows.length > normalizedLimit;
      const items = rows.slice(0, normalizedLimit).map((row) => mapRow(row));

      return {
        operationId: input.operationId,
        logsAvailable: true,
        items,
        nextAfter: items.at(-1)?.sequence ?? null,
        hasMore
      };
    }

    if (normalizedTail !== null) {
      const rows = this.db
        .prepare(
          `
            SELECT operation_id, sequence, step_id, stream, line, created_at
            FROM operation_logs
            WHERE operation_id = ?
              ${stepWhere}
            ORDER BY sequence DESC
            LIMIT ?
          `
        )
        .all(input.operationId, ...stepParameters, normalizedTail) as OperationLogRow[];

      const countRow = this.db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM operation_logs
            WHERE operation_id = ?
              ${stepWhere}
          `
        )
        .get(input.operationId, ...stepParameters) as { count: number } | undefined;

      const items = rows.reverse().map((row) => mapRow(row));
      return {
        operationId: input.operationId,
        logsAvailable: true,
        items,
        nextAfter: items.at(-1)?.sequence ?? null,
        hasMore: false
      };
    }

    const rows = this.db
      .prepare(
        `
          SELECT operation_id, sequence, step_id, stream, line, created_at
          FROM operation_logs
          WHERE operation_id = ?
            ${stepWhere}
          ORDER BY sequence ASC
          LIMIT ?
        `
      )
      .all(input.operationId, ...stepParameters, normalizedLimit + 1) as OperationLogRow[];

    const hasMore = rows.length > normalizedLimit;
    const items = rows.slice(0, normalizedLimit).map((row) => mapRow(row));
    return {
      operationId: input.operationId,
      logsAvailable: true,
      items,
      nextAfter: items.at(-1)?.sequence ?? null,
      hasMore
    };
  }

  deleteLogsForCompletedOperationsBefore(cutoffIso: string): number {
    const targetOperationIds = this.db
      .prepare(
        `
          SELECT DISTINCT operation_id
          FROM operations
          WHERE status IN ('succeeded', 'failed', 'cancelled', 'interrupted')
            AND finished_at IS NOT NULL
            AND finished_at < ?
        `
      )
      .all(cutoffIso) as Array<{ operation_id: string }>;

    if (targetOperationIds.length === 0) {
      return 0;
    }

    const deleteLogs = this.db.prepare("DELETE FROM operation_logs WHERE operation_id = ?");
    const markUnavailable = this.db.prepare("UPDATE operations SET logs_available = 0, updated_at = ? WHERE operation_id = ?");

    const tx = this.db.transaction((operationIds: string[]) => {
      let deletedOperations = 0;
      for (const operationId of operationIds) {
        deleteLogs.run(operationId);
        markUnavailable.run(cutoffIso, operationId);
        deletedOperations += 1;
      }
      return deletedOperations;
    });

    return tx(targetOperationIds.map((row) => row.operation_id));
  }
}

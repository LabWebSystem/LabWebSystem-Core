import type Database from "better-sqlite3";
import { OperationLogRepository, type OperationLogListResult } from "./operation-log.repository.js";
import { OperationNotFoundError } from "./operation-errors.js";
import { InMemoryOperationEventBus, type OperationEventBus } from "./operation-events.js";
import { OperationRepository } from "./operation.repository.js";
import type { OperationDetailDto, OperationDto, OperationLogStream, OperationParameters, OperationType } from "./operation-types.js";

type OperationScheduler = (operationId: string) => void;

type OperationServiceOptions = {
  db: Database.Database;
  now?: () => string;
  eventBus?: OperationEventBus;
  autoStart?: boolean;
  scheduleOperation?: OperationScheduler;
};

export class OperationService {
  readonly repository: OperationRepository;
  readonly logs: OperationLogRepository;
  readonly eventBus: OperationEventBus;

  private readonly db: Database.Database;
  private readonly now: () => string;
  private readonly autoStart: boolean;
  private readonly scheduleOperation: OperationScheduler;

  constructor(options: OperationServiceOptions) {
    this.db = options.db;
    this.repository = new OperationRepository(options.db);
    this.logs = new OperationLogRepository(options.db);
    this.eventBus = options.eventBus ?? new InMemoryOperationEventBus();
    this.now = options.now ?? (() => new Date().toISOString());
    this.autoStart = options.autoStart ?? true;
    this.scheduleOperation = options.scheduleOperation ?? ((operationId) => void operationId);
  }

  async createOperation(input: {
    applicationId: string;
    type: OperationType;
    parameters: OperationParameters;
  }): Promise<OperationDetailDto> {
    this.assertActiveApplication(input.applicationId);
    const created = this.repository.createOperation({
      applicationId: input.applicationId,
      type: input.type,
      parameters: input.parameters,
      timestamp: this.now()
    });

    if (this.autoStart) {
      queueMicrotask(() => {
        this.scheduleOperation(created.operationId);
      });
    }

    return created;
  }

  async listOperationsByApplicationId(applicationId: string, limit = 50): Promise<OperationDto[]> {
    this.assertApplicationExists(applicationId);
    return this.repository.listByApplicationId(applicationId, limit);
  }

  async getOperation(operationId: string): Promise<OperationDto> {
    return this.repository.getOperation(operationId);
  }

  async getOperationDetail(operationId: string): Promise<OperationDetailDto> {
    return this.repository.getDetail(operationId);
  }

  async cancelOperation(operationId: string): Promise<OperationDetailDto> {
    return this.repository.cancelQueuedOperation(operationId, this.now());
  }

  async retryOperation(operationId: string): Promise<OperationDetailDto> {
    return this.repository.retryOperation(operationId, this.now());
  }

  async markIncompleteOperationsAsInterrupted(): Promise<OperationDto[]> {
    return this.repository.markIncompleteAsInterrupted(this.now());
  }

  async listOperationLogs(input: {
    operationId: string;
    after?: number | null;
    limit?: number | null;
    tail?: number | null;
    stepId?: string | null;
  }): Promise<OperationLogListResult> {
    const operation = await this.getOperation(input.operationId);
    return this.logs.listLogs({
      operationId: input.operationId,
      logsAvailable: operation.logsAvailable,
      after: input.after,
      limit: input.limit,
      tail: input.tail,
      stepId: input.stepId
    });
  }

  appendOperationLog(input: {
    operationId: string;
    stepId: string | null;
    sequence: number;
    stream: OperationLogStream;
    line: string;
    createdAt?: string;
  }): boolean {
    return this.logs.appendLog({
      operationId: input.operationId,
      stepId: input.stepId,
      sequence: input.sequence,
      stream: input.stream,
      line: input.line,
      createdAt: input.createdAt ?? this.now()
    });
  }

  getOperationDetailOrNull(operationId: string): OperationDetailDto | null {
    try {
      return this.repository.getDetail(operationId);
    } catch (error) {
      if (error instanceof OperationNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  private assertApplicationExists(applicationId: string): void {
    const row = this.db
      .prepare("SELECT application_id FROM applications WHERE application_id = ?")
      .get(applicationId) as { application_id: string } | undefined;

    if (!row) {
      throw new OperationNotFoundError("Application not found.");
    }
  }

  private assertActiveApplication(applicationId: string): void {
    const row = this.db
      .prepare("SELECT application_id, deleted_at FROM applications WHERE application_id = ?")
      .get(applicationId) as { application_id: string; deleted_at: string | null } | undefined;

    if (!row || row.deleted_at) {
      throw new OperationNotFoundError("Application not found.");
    }
  }
}

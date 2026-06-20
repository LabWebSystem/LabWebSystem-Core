export class OperationConflictError extends Error {
  readonly code = "APPLICATION_OPERATION_CONFLICT";

  constructor(
    message: string,
    readonly details: Record<string, unknown>
  ) {
    super(message);
  }
}

export class OperationNotFoundError extends Error {
  readonly code = "OPERATION_NOT_FOUND";

  constructor(message = "Operation not found.") {
    super(message);
  }
}

export class OperationStateError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

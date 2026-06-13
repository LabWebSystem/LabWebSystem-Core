export class DashboardInvariantError extends Error {
  public override readonly name = 'DashboardInvariantError';
}

export class DashboardOperationError extends Error {
  public override readonly name = 'DashboardOperationError';
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new DashboardInvariantError(message);
  }
}

export function operationGuard(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new DashboardOperationError(message);
  }
}

export function assertNever(value: never): never {
  throw new DashboardInvariantError(`Unexpected value: ${String(value)}`);
}

export const operationTypes = [
  "deploy",
  "restart",
  "stop",
  "resume",
  "rebuild",
  "update-check",
  "update",
  "rollback",
  "delete"
] as const;

export const operationStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted"
] as const;

export const operationStepStatuses = ["pending", "running", "succeeded", "failed", "skipped"] as const;
export const operationLogStreams = ["stdout", "stderr", "system"] as const;
export const terminalOperationStatuses = ["succeeded", "failed", "cancelled", "interrupted"] as const;

export type OperationType = (typeof operationTypes)[number];
export type OperationStatus = (typeof operationStatuses)[number];
export type OperationStepStatus = (typeof operationStepStatuses)[number];
export type OperationLogStream = (typeof operationLogStreams)[number];
export type TerminalOperationStatus = (typeof terminalOperationStatuses)[number];

export type DeleteMode = "configOnly" | "sourceAndConfig" | "full";
export type InternalDeleteMode = "config_only" | "source_and_config" | "full";

export type DeployParameters = {
  rebuild?: boolean;
};

export type RebuildParameters = {
  keepData?: boolean;
};

export type RevisionParameters = {
  targetRevision: string;
};

export type DeleteParameters = {
  mode: DeleteMode;
};

export type OperationParameters =
  | DeployParameters
  | RebuildParameters
  | RevisionParameters
  | DeleteParameters
  | Record<string, never>;

export type OperationErrorDto = {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
};

export type OperationLinkSet = {
  self: string;
  logs: string;
  logStream: string;
};

export type OperationDto = {
  operationId: string;
  applicationId: string;
  type: OperationType;
  status: OperationStatus;
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepOrder: number | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  parameters: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: OperationErrorDto | null;
  retryOfOperationId: string | null;
  logsAvailable: boolean;
  canCancel: boolean;
  canRetry: boolean;
  links: OperationLinkSet;
};

export type OperationStepDto = {
  stepId: string;
  operationId: string;
  stepOrder: number;
  name: string;
  status: OperationStepStatus;
  startedAt: string | null;
  updatedAt: string;
  finishedAt: string | null;
  message: string | null;
  errorCode: string | null;
  details: Record<string, unknown> | null;
};

export type OperationLogItemDto = {
  operationId: string;
  sequence: number;
  stepId: string | null;
  stream: OperationLogStream;
  line: string;
  createdAt: string;
};

export type OperationDetailDto = OperationDto & {
  steps: OperationStepDto[];
};

export const deleteModeToInternal: Record<DeleteMode, InternalDeleteMode> = {
  configOnly: "config_only",
  sourceAndConfig: "source_and_config",
  full: "full"
};

export function isTerminalOperationStatus(status: OperationStatus): status is TerminalOperationStatus {
  return terminalOperationStatuses.includes(status as TerminalOperationStatus);
}

export function canCancelOperation(status: OperationStatus): boolean {
  return status === "queued";
}

export function canRetryOperation(status: OperationStatus): boolean {
  return status === "failed" || status === "interrupted";
}

export function buildOperationLinks(operationId: string): OperationLinkSet {
  return {
    self: `/api/operations/${operationId}`,
    logs: `/api/operations/${operationId}/logs`,
    logStream: `/api/operations/${operationId}/logs/stream`
  };
}

export function buildInitialStepNames(type: OperationType): string[] {
  switch (type) {
    case "deploy":
      return ["resolveRepository", "cloneOrPullRepository", "inspectCompose", "dockerComposeUpWithBuild", "syncInfrastructure"];
    case "restart":
      return ["dockerComposeRestart"];
    case "stop":
      return ["dockerComposeStop", "syncInfrastructure"];
    case "resume":
      return ["dockerComposeUp", "syncInfrastructure"];
    case "rebuild":
      return ["dockerComposeDown", "dockerComposeUpWithBuild", "syncInfrastructure"];
    case "update-check":
      return ["resolveRepository", "fetchRemoteRevision"];
    case "update":
      return ["resolveRepository", "cloneOrPullRepository", "inspectCompose", "dockerComposeUpWithBuild", "syncInfrastructure"];
    case "rollback":
      return ["resolveRepository", "checkoutTargetRevision", "inspectCompose", "dockerComposeUpWithBuild", "syncInfrastructure"];
    case "delete":
      return ["disableExposure", "dockerComposeDown", "cleanupSource", "cleanupAppData", "syncInfrastructure"];
  }
}

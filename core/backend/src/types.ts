export type ApplicationStatus =
  | "Draft"
  | "Registered"
  | "Cloning"
  | "Build Pending"
  | "Deploying"
  | "Running"
  | "Degraded"
  | "Stopped"
  | "Failed"
  | "Rebuilding"
  | "Deleting"
  | "Deleted";

export type DeploymentMode = "standard" | "headless";

export type EventLevel = "info" | "warning" | "error";

export type JobType =
  | "clone"
  | "build"
  | "deploy"
  | "stop"
  | "resume"
  | "rebuild"
  | "delete"
  | "update-check"
  | "update"
  | "rollback"
  | "restart";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type OperationType =
  | "deploy"
  | "restart"
  | "stop"
  | "resume"
  | "rebuild"
  | "update-check"
  | "update"
  | "rollback"
  | "delete";

export type OperationStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "interrupted";

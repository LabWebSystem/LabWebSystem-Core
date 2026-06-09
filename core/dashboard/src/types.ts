export type SystemStatus = {
  generatedAt: string;
  applicationSummary: {
    total: number;
    running: number;
    degraded: number;
    failed: number;
  };
  jobSummary: {
    queued: number;
    running: number;
  };
  execution?: {
    mode: "dry-run" | "execute";
    mainServiceIp: string;
    sshServiceIp: string;
    rootDomain: string;
  };
  dnsServer?: {
    enabled: boolean;
    bindHost: string;
    port: number;
    hostsFilePath: string;
    upstreams: string[];
    udpListening: boolean;
    tcpListening: boolean;
    lastError: string | null;
    relay?: {
      required: boolean;
      targetHost: string;
      targetPort: number;
      udpReachable: boolean;
      tcpReachable: boolean;
      lastError: string | null;
    };
  };
};

export type ApplicationListItem = {
  application_id: string;
  name: string;
  description: string;
  repository_url: string;
  default_branch: string;
  current_commit: string | null;
  previous_commit: string | null;
  status: string;
  created_at: string;
  hostname: string;
  public_port: number;
  public_service_name: string;
  mode: "standard" | "headless";
  enabled?: boolean;
  has_update: boolean;
  updated_at: string;
  latest_error_title?: string | null;
  latest_error_message?: string | null;
  latest_error_at?: string | null;
  latest_job_type?: string | null;
  latest_job_status?: "queued" | "running" | "succeeded" | "failed" | "cancelled" | null;
  latest_job_message?: string | null;
  latest_job_created_at?: string | null;
  latest_job_started_at?: string | null;
  latest_job_finished_at?: string | null;
  active_job_id?: string | null;
  active_job_type?: string | null;
  active_job_status?: "queued" | "running" | null;
  active_job_message?: string | null;
  active_job_created_at?: string | null;
  active_job_started_at?: string | null;
  health?: ApplicationHealthCheck | null;
};

export type SystemEvent = {
  event_id: string;
  scope?: string;
  application_id?: string | null;
  application_name?: string | null;
  level: "info" | "warning" | "error";
  title: string;
  message: string;
  created_at: string;
};

export type CreateApplicationPayload = {
  name: string;
  description: string;
  repositoryUrl: string;
  defaultBranch: string;
  composePath: string;
  publicServiceName: string;
  publicPort: number;
  hostname: string;
  mode: "standard" | "headless";
  keepVolumesOnRebuild: boolean;
  deviceRequirements: string[];
  envOverrides: Record<string, string>;
};

export type ImportResolvedManifest = {
  schemaVersion: number;
  app: {
    name: string;
    description: string;
  };
  repository: {
    url: string;
    defaultBranch: string;
  };
  deployment: {
    composePath: string;
    mode: "standard" | "headless";
    keepVolumesOnRebuild: boolean;
  };
  exposure: {
    service: string;
    port: number;
    hostname: string;
  };
  devices: {
    required: string[];
  };
  env: {
    required: string[];
    defaults: Record<string, string>;
  };
  profiles: {
    default: string;
  };
};

export type CreateApplicationResponse = {
  applicationId: string;
  deploymentId: string;
  routeId: string;
  jobId: string;
  message: string;
};

export type ImportResolveResponse = {
  canonicalRepositoryUrl: string;
  resolvedBranch: string;
  branchFixed: boolean;
  branchCandidates: string[];
  repositoryFiles: string[];
  yamlFiles: string[];
  composeCandidates: string[];
  recommendedComposePath: string | null;
  manifestPath: string;
  manifest: ImportResolvedManifest;
  warning?: string;
};

export type ComposeServiceCandidate = {
  name: string;
  portOptions: number[];
  publishedPorts: number[];
  exposePorts: number[];
  detectedPublicPort: number | null;
  likelyPublic: boolean;
  reason: string;
};

export type ComposeInspectionSource = {
  kind: "github" | "local";
  path: string;
  repositoryUrl?: string;
  branch?: string;
  blobUrl?: string;
  absolutePath?: string;
};

export type ComposeEnvironmentRequirement = {
  name: string;
  required: boolean;
  defaultValue: string | null;
  services: string[];
};

export type ComposeInspectionPayload = {
  composeCandidates: string[];
  yamlFiles: string[];
  recommendedComposePath: string | null;
  selectedComposePath: string;
  services: ComposeServiceCandidate[];
  environmentRequirements: ComposeEnvironmentRequirement[];
  serviceEnvironmentRequirements: Array<{
    serviceName: string;
    variables: Array<{
      name: string;
      required: boolean;
      defaultValue: string | null;
    }>;
  }>;
  detectedDeviceRequirements: string[];
  serviceDeviceRequirements: Array<{
    serviceName: string;
    devicePaths: string[];
  }>;
  rawYaml: string;
  parsedYaml: unknown | null;
  parseError: string | null;
  parseWarnings: string[];
  analysisWarnings: string[];
  source: ComposeInspectionSource;
};

export type ImportComposeInspectResponse = ComposeInspectionPayload;

export type DeleteMode = "config_only" | "source_and_config" | "full";

export type RegistrationFixture = {
  id: string;
  label: string;
  payload: CreateApplicationPayload;
};

export type ApplicationLogsResponse = {
  applicationId: string;
  applicationName: string;
  service: string | null;
  tail: number;
  lines: string[];
  fetchedAt: string;
  executionMode: "dry-run" | "execute";
};

export type ApplicationDeployment = {
  deployment_id: string;
  compose_path: string;
  compose_project_name: string | null;
  public_service_name: string;
  public_port: number;
  hostname: string;
  mode: "standard" | "headless";
  keep_volumes_on_rebuild: boolean;
  device_requirements: string[];
  env_overrides: Record<string, string>;
  enabled: boolean;
};

export type ApplicationRoute = {
  route_id: string;
  hostname: string;
  upstream_container: string | null;
  upstream_port: number;
  enabled: boolean;
};

export type ApplicationContainerInstance = {
  container_id: string;
  service_name: string;
  runtime_name: string;
  health_state: string;
  restart_count: number;
  last_seen_at: string;
};

export type ApplicationUpdateInfo = {
  current_commit: string | null;
  latest_remote_commit: string | null;
  has_update: boolean;
  checked_at: string;
};

export type ApplicationComposeInspection = ComposeInspectionPayload;

export type ApplicationHealthCheck = {
  state: "healthy" | "slow" | "page_error" | "runtime_error" | "unreachable" | "pending" | "stopped" | "unknown";
  severity: "ok" | "warning" | "critical" | "inactive" | "unknown";
  summary: string;
  checked_at: string;
  url: string | null;
  http_status: number | null;
  response_time_ms: number | null;
  reachable: boolean | null;
  container_summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  detail: string | null;
};

export type ApplicationJob = {
  job_id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  related_application_id: string | null;
  created_at: string;
  application_name?: string | null;
  request_payload?: Record<string, unknown>;
  retryable?: boolean;
  cancellable?: boolean;
  dismissible?: boolean;
};

export type ApplicationDetail = {
  application: {
    application_id: string;
    name: string;
    description: string;
    repository_url: string;
    default_branch: string;
    current_commit: string | null;
    previous_commit: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  };
  deployment: ApplicationDeployment | null;
  health: ApplicationHealthCheck | null;
  composeInspection: ApplicationComposeInspection | null;
  routes: ApplicationRoute[];
  containers: ApplicationContainerInstance[];
  updateInfo: ApplicationUpdateInfo | null;
  events: SystemEvent[];
  jobs: ApplicationJob[];
};

export type UpdateDeploymentPayload = {
  composePath: string;
  publicServiceName: string;
  publicPort: number;
  hostname: string;
  keepVolumesOnRebuild: boolean;
  envOverrides: Record<string, string>;
};

export type DashboardBreakpoint = "lg" | "md" | "sm" | "xs";

export type DashboardWidgetType =
  | "status"
  | "cpu"
  | "memory"
  | "disk"
  | "network"
  | "alert"
  | "log"
  | "chart"
  | "applications"
  | "jobs"
  | "events";

export type DashboardPage = {
  id: string;
  title: string;
  isDraft?: boolean;
};

export type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  pageId: string;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
  config?: {
    applicationId?: string | null;
  };
};

export type DashboardLayoutItem = {
  i: string;
  pageId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
};

export type DashboardResponsiveLayouts = Record<DashboardBreakpoint, DashboardLayoutItem[]>;

export type DashboardLayoutDocument = {
  version?: number;
  pages: DashboardPage[];
  widgets: DashboardWidget[];
  layouts: DashboardResponsiveLayouts;
  currentPageId: string;
};

export type DashboardLayoutResponse = {
  dashboardId: string;
  userId: string;
  layout: DashboardLayoutDocument | null;
  updatedAt: string | null;
};

export type DashboardMetrics = {
  generatedAt: string;
  cpu: {
    usagePercent: number;
    loadAverage1m: number;
    loadAverage5m: number;
    loadAverage15m: number;
    coreCount: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
  };
  disk: {
    path: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
  };
  network: {
    interfaceCount: number;
    interfaces: Array<{
      name: string;
      family: string;
      address: string;
      mac: string;
    }>;
    primaryAddress: string | null;
    dnsEnabled: boolean;
    dnsBindHost: string;
    dnsPort: number;
    rootDomain: string;
  };
  alerts: Array<{
    event_id: string;
    scope: string;
    application_id: string | null;
    level: "warning" | "error";
    title: string;
    message: string;
    created_at: string;
  }>;
};

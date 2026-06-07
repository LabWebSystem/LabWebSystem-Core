import type { ApplicationHealthCheck, ApplicationJob, ApplicationListItem } from "./types";

type Tone = "ok" | "warn" | "error" | "info" | "neutral" | "inactive";

function badgeClassForTone(tone: Tone): string {
  switch (tone) {
    case "ok":
      return "badge badge-ok";
    case "warn":
      return "badge badge-warn";
    case "error":
      return "badge badge-error";
    case "info":
      return "badge badge-info";
    case "inactive":
      return "badge badge-inactive";
    default:
      return "badge";
  }
}

export function toLocale(value: string | null | undefined): string {
  if (!value) {
    return "未記録";
  }

  try {
    return new Date(value).toLocaleString("ja-JP");
  } catch {
    return value;
  }
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) {
    return "未記録";
  }

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return value;
  }

  const diffMs = Date.now() - time;
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 1) {
    return "たった今";
  }
  if (Math.abs(diffMinutes) < 60) {
    return `${diffMinutes}分前`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return `${diffHours}時間前`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}日前`;
}

export function formatElapsed(startedAt: string | null | undefined, finishedAt?: string | null): string {
  if (!startedAt) {
    return "未開始";
  }

  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "計測不可";
  }

  const diffSeconds = Math.max(0, Math.round((end - start) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

export function shortCommit(value: string | null): string {
  if (!value) {
    return "未取得";
  }
  return value.length > 12 ? value.slice(0, 12) : value;
}

export function jobTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "deploy":
      return "デプロイ";
    case "restart":
      return "再起動";
    case "stop":
      return "停止";
    case "resume":
      return "再開";
    case "rebuild":
      return "再ビルド";
    case "update-check":
      return "更新確認";
    case "update":
      return "更新適用";
    case "rollback":
      return "ロールバック";
    case "delete":
      return "削除";
    default:
      return type ?? "ジョブ";
  }
}

export function jobStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "queued":
      return "待機中";
    case "running":
      return "実行中";
    case "succeeded":
      return "成功";
    case "failed":
      return "失敗";
    case "cancelled":
      return "キャンセル";
    default:
      return "未設定";
  }
}

export function jobStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "succeeded":
      return badgeClassForTone("ok");
    case "failed":
      return badgeClassForTone("error");
    case "queued":
    case "running":
      return badgeClassForTone("warn");
    case "cancelled":
      return badgeClassForTone("inactive");
    default:
      return badgeClassForTone("neutral");
  }
}

export function canCancelJob(job: ApplicationJob): boolean {
  return job.cancellable ?? job.status === "queued";
}

export function canRetryJob(job: ApplicationJob): boolean {
  return job.retryable ?? (job.status === "failed" && job.related_application_id !== null);
}

export function canDeleteJob(job: ApplicationJob): boolean {
  return job.dismissible ?? ["succeeded", "failed", "cancelled"].includes(job.status);
}

export function applicationStatusMeta(status: string): { label: string; tone: Tone; description: string } {
  switch (status) {
    case "Build Pending":
      return { label: "追加受付済み", tone: "info", description: "登録は完了しています。初回デプロイ待ちです。" };
    case "Cloning":
      return { label: "取得中", tone: "info", description: "リポジトリを取得しています。" };
    case "Deploying":
      return { label: "デプロイ中", tone: "warn", description: "現在のデプロイ処理が進行中です。" };
    case "Running":
      return { label: "稼働中", tone: "ok", description: "アプリは公開状態です。" };
    case "Degraded":
      return { label: "注意", tone: "warn", description: "稼働していますが、要確認の状態です。" };
    case "Stopped":
      return { label: "停止中", tone: "inactive", description: "意図的に停止しています。" };
    case "Failed":
      return { label: "失敗", tone: "error", description: "直近の処理が失敗しています。" };
    case "Rebuilding":
      return { label: "再構築中", tone: "warn", description: "再ビルドまたは再生成処理を進めています。" };
    case "Deleting":
      return { label: "削除中", tone: "warn", description: "削除ジョブを実行しています。" };
    default:
      return { label: status, tone: "neutral", description: "状態を判定できません。" };
  }
}

export function statusBadgeClass(status: string): string {
  return badgeClassForTone(applicationStatusMeta(status).tone);
}

export function healthMeta(health: ApplicationHealthCheck | null | undefined): { label: string; tone: Tone; description: string } {
  if (!health) {
    return { label: "未確認", tone: "neutral", description: "まだヘルスチェック結果がありません。" };
  }

  switch (health.state) {
    case "healthy":
      return { label: "正常", tone: "ok", description: health.summary };
    case "slow":
      return { label: "遅延", tone: "warn", description: health.summary };
    case "page_error":
      return { label: "画面確認", tone: "warn", description: health.summary };
    case "runtime_error":
      return { label: "異常", tone: "error", description: health.summary };
    case "unreachable":
      return { label: "到達不可", tone: "error", description: health.summary };
    case "pending":
      return { label: "処理中", tone: "info", description: health.summary };
    case "stopped":
      return { label: "停止", tone: "inactive", description: health.summary };
    default:
      return { label: "未確認", tone: "neutral", description: health.summary };
  }
}

export function healthBadgeClass(health: ApplicationHealthCheck | null | undefined): string {
  return badgeClassForTone(healthMeta(health).tone);
}

export function applicationModeLabel(mode: "standard" | "headless"): string {
  return mode === "headless" ? "ヘッドレス" : "標準";
}

export function getActiveJob(application: ApplicationListItem | null | undefined): ApplicationJob | null {
  if (!application?.active_job_id || !application.active_job_status) {
    return null;
  }

  return {
    job_id: application.active_job_id,
    type: application.active_job_type ?? "job",
    status: application.active_job_status,
    started_at: application.active_job_started_at ?? null,
    finished_at: null,
    message: application.active_job_message ?? null,
    related_application_id: application.application_id,
    created_at: application.active_job_created_at ?? application.updated_at,
    application_name: application.name
  };
}

export function buildOperationLockReason(application: ApplicationListItem | null | undefined): string | null {
  const activeJob = getActiveJob(application);
  if (activeJob) {
    return `${jobTypeLabel(activeJob.type)}が${jobStatusLabel(activeJob.status)}のため、完了まで他の操作を止めています。`;
  }

  return null;
}

export function buildAttentionSummary(application: ApplicationListItem): string {
  const activeJob = getActiveJob(application);
  if (activeJob?.message) {
    return activeJob.message;
  }
  if (application.latest_error_title) {
    return application.latest_error_title;
  }
  if (application.health?.detail) {
    return application.health.detail;
  }

  return applicationStatusMeta(application.status).description;
}

export function logLineClass(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes("error") || lower.includes("failed") || lower.includes("exception")) {
    return "log-line error";
  }
  if (lower.includes("warn")) {
    return "log-line warning";
  }
  return "log-line";
}

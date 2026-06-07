import type { ApplicationJob, ApplicationListItem, SystemEvent, SystemStatus } from "../types";
import {
  applicationStatusMeta,
  buildAttentionSummary,
  formatElapsed,
  formatRelative,
  healthBadgeClass,
  healthMeta,
  jobStatusBadgeClass,
  jobStatusLabel,
  jobTypeLabel,
  statusBadgeClass,
  toLocale
} from "../ui";

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenDetail: (applicationId: string) => void;
  onRetryJob: (jobId: string, typeLabel: string) => void;
  onCancelJob: (jobId: string) => void;
};

export function HomeView(props: HomeViewProps) {
  const { system, applications, jobs, events, onOpenApplications, onOpenDetail, onRetryJob, onCancelJob } = props;

  const attentionApps = applications
    .filter((application) => {
      const severity = application.health?.severity;
      return severity === "critical" || severity === "warning" || application.status === "Failed";
    })
    .slice(0, 6);
  const runningJobs = jobs.filter((job) => job.status === "queued" || job.status === "running").slice(0, 8);
  const failedJobs = jobs.filter((job) => job.status === "failed").slice(0, 8);
  const recentEvents = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  const slowApps = applications
    .filter((application) => application.health?.state === "slow")
    .sort((a, b) => (b.health?.response_time_ms ?? 0) - (a.health?.response_time_ms ?? 0))
    .slice(0, 5);
  const recentApps = [...applications].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  const healthyCount = applications.filter((application) => application.health?.severity === "ok").length;
  const warningCount = applications.filter((application) => application.health?.severity === "warning").length;
  const criticalCount = applications.filter((application) => application.health?.severity === "critical").length;

  return (
    <div className="view-grid dashboard-home">
      <section className="hero-grid">
        <article className="hero-card panel-card">
          <div className="hero-copy">
            <p className="section-kicker">OVERVIEW</p>
            <h2>今どこに注意すべきかを、最初の一画面で把握できます。</h2>
            <p className="panel-sub">
              登録済みアプリ、実行中ジョブ、直近イベントをまとめて確認しながら、詰まりや失敗をすぐ追える構成に更新しました。
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" className="button primary" onClick={onOpenApplications}>
              アプリ一覧を開く
            </button>
            {system?.execution ? (
              <p className="hero-meta">
                監視対象ドメイン: <strong>{system.execution.rootDomain}</strong>
              </p>
            ) : null}
          </div>
        </article>

        <div className="summary-grid">
          <article className="metric-card">
            <p>登録アプリ</p>
            <strong>{applications.length}</strong>
            <span>{system?.applicationSummary.running ?? 0} 件が稼働中</span>
          </article>
          <article className="metric-card ok">
            <p>正常</p>
            <strong>{healthyCount}</strong>
            <span>URL とコンテナが安定</span>
          </article>
          <article className="metric-card warn">
            <p>要確認</p>
            <strong>{warningCount}</strong>
            <span>遅延や画面確認が必要</span>
          </article>
          <article className="metric-card error">
            <p>異常</p>
            <strong>{criticalCount}</strong>
            <span>到達不可または実行エラー</span>
          </article>
          <article className="metric-card info">
            <p>進行中ジョブ</p>
            <strong>{runningJobs.length}</strong>
            <span>待機中を含む</span>
          </article>
          <article className="metric-card">
            <p>失敗ジョブ</p>
            <strong>{failedJobs.length}</strong>
            <span>再実行の候補</span>
          </article>
        </div>
      </section>

      <section className="split-grid home-primary-grid">
        <article className="panel-card scroll-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">APPS</p>
              <h2>注意が必要なアプリ</h2>
            </div>
            <button type="button" className="button ghost" onClick={onOpenApplications}>
              全一覧
            </button>
          </div>
          <div className="panel-scroll card-list">
            {attentionApps.length === 0 ? <p className="empty-message">現在、優先対応が必要なアプリはありません。</p> : null}
            {attentionApps.map((application) => {
              const health = healthMeta(application.health);
              const status = applicationStatusMeta(application.status);

              return (
                <article key={application.application_id} className="app-spotlight-card">
                  <div className="app-spotlight-head">
                    <div>
                      <strong>{application.name}</strong>
                      <p>{application.hostname}</p>
                    </div>
                    <div className="badge-row">
                      <span className={healthBadgeClass(application.health)}>{health.label}</span>
                      <span className={statusBadgeClass(application.status)}>{status.label}</span>
                    </div>
                  </div>
                  <p className="spotlight-copy">{buildAttentionSummary(application)}</p>
                  <div className="spotlight-meta">
                    <span>最終更新 {formatRelative(application.updated_at)}</span>
                    {application.health?.response_time_ms ? <span>{application.health.response_time_ms}ms</span> : null}
                  </div>
                  <div className="spotlight-actions">
                    <button type="button" className="button tiny primary" onClick={() => onOpenDetail(application.application_id)}>
                      詳細を見る
                    </button>
                    <a className="button tiny ghost" href={`http://${application.hostname}`} target="_blank" rel="noreferrer">
                      公開 URL
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        <article className="panel-card scroll-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">QUEUE</p>
              <h2>実行中・待機中のジョブ</h2>
            </div>
          </div>
          <div className="panel-scroll card-list">
            {runningJobs.length === 0 ? <p className="empty-message">進行中のジョブはありません。</p> : null}
            {runningJobs.map((job) => (
              <article key={job.job_id} className="job-card">
                <div className="job-card-head">
                  <div>
                    <strong>{job.application_name ?? "システム"}</strong>
                    <p>{jobTypeLabel(job.type)}</p>
                  </div>
                  <span className={jobStatusBadgeClass(job.status)}>{jobStatusLabel(job.status)}</span>
                </div>
                {job.message ? <p className="job-card-copy">{job.message}</p> : null}
                <div className="job-card-meta">
                  <span>作成 {formatRelative(job.created_at)}</span>
                  <span>経過 {formatElapsed(job.started_at ?? job.created_at)}</span>
                </div>
                <div className="job-card-actions">
                  {job.related_application_id ? (
                    <button
                      type="button"
                      className="button tiny ghost"
                      onClick={() => onOpenDetail(job.related_application_id as string)}
                    >
                      対象アプリ
                    </button>
                  ) : null}
                  {job.cancellable ? (
                    <button type="button" className="button tiny warn" onClick={() => onCancelJob(job.job_id)}>
                      待機を取り消す
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="split-grid home-secondary-grid">
        <article className="panel-card scroll-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">EVENTS</p>
              <h2>直近イベント</h2>
            </div>
          </div>
          <div className="panel-scroll">
            {recentEvents.length === 0 ? <p className="empty-message">イベントはまだありません。</p> : null}
            <ul className="event-list">
              {recentEvents.map((event) => (
                <li key={event.event_id} className={`event-item ${event.level}`}>
                  <div>
                    <strong>{event.title}</strong>
                    {event.application_name ? <p className="event-app">対象: {event.application_name}</p> : null}
                    <p>{event.message}</p>
                  </div>
                  <time>{toLocale(event.created_at)}</time>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="panel-card scroll-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">CHANGES</p>
              <h2>最近の追加と失敗ジョブ</h2>
            </div>
          </div>
          <div className="panel-scroll stacked-blocks">
            <section className="mini-section">
              <h3>最近追加されたアプリ</h3>
              <ul className="simple-list">
                {recentApps.map((application) => (
                  <li key={application.application_id} className="list-row compact">
                    <div>
                      <strong>{application.name}</strong>
                      <p>{formatRelative(application.created_at)}</p>
                    </div>
                    <button type="button" className="button tiny ghost" onClick={() => onOpenDetail(application.application_id)}>
                      詳細
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mini-section">
              <h3>応答が遅いアプリ</h3>
              {slowApps.length === 0 ? <p className="empty-message">現在はありません。</p> : null}
              <ul className="simple-list">
                {slowApps.map((application) => (
                  <li key={application.application_id} className="list-row compact">
                    <div>
                      <strong>{application.name}</strong>
                      <p>{application.health?.response_time_ms ?? "-"}ms / {application.health?.summary ?? "監視中"}</p>
                    </div>
                    <button type="button" className="button tiny ghost" onClick={() => onOpenDetail(application.application_id)}>
                      詳細
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mini-section">
              <h3>失敗ジョブ</h3>
              {failedJobs.length === 0 ? <p className="empty-message">再実行待ちの失敗ジョブはありません。</p> : null}
              <ul className="simple-list">
                {failedJobs.map((job) => (
                  <li key={job.job_id} className="job-list-row">
                    <div>
                      <strong>{job.application_name ?? "システム"}</strong>
                      <p>{jobTypeLabel(job.type)} / {job.message ?? "失敗しました"}</p>
                      <p>{toLocale(job.finished_at ?? job.created_at)}</p>
                    </div>
                    <div className="list-actions">
                      <span className={jobStatusBadgeClass(job.status)}>{jobStatusLabel(job.status)}</span>
                      {job.retryable ? (
                        <button
                          type="button"
                          className="button tiny primary"
                          onClick={() => onRetryJob(job.job_id, jobTypeLabel(job.type))}
                        >
                          再実行
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </section>
    </div>
  );
}

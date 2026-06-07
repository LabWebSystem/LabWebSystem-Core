import type { ApplicationListItem } from "../types";
import {
  applicationModeLabel,
  applicationStatusMeta,
  buildAttentionSummary,
  buildOperationLockReason,
  formatRelative,
  getActiveJob,
  healthBadgeClass,
  healthMeta,
  jobStatusBadgeClass,
  jobStatusLabel,
  jobTypeLabel,
  shortCommit,
  statusBadgeClass
} from "../ui";

type ApplicationsViewProps = {
  applications: ApplicationListItem[];
  selectedApplicationId: string | null;
  onOpenDetail: (applicationId: string) => void;
};

export function ApplicationsView(props: ApplicationsViewProps) {
  const { applications, selectedApplicationId, onOpenDetail } = props;

  return (
    <div className="view-grid applications-view">
      <section className="panel-card grow">
        <div className="panel-head">
          <div>
            <p className="section-kicker">APPLICATIONS</p>
            <h2>アプリ一覧</h2>
            <p className="panel-sub">運用に必要な状態、ヘルス、進行中ジョブを1カードに集約しています。</p>
          </div>
          <p className="table-count">{applications.length} 件</p>
        </div>

        {applications.length === 0 ? <p className="empty-message">登録されたアプリはありません。</p> : null}

        <div className="app-card-grid">
          {applications.map((application) => {
            const status = applicationStatusMeta(application.status);
            const health = healthMeta(application.health);
            const activeJob = getActiveJob(application);
            const lockReason = buildOperationLockReason(application);

            return (
              <article
                key={application.application_id}
                className={`app-card ${selectedApplicationId === application.application_id ? "selected" : ""}`}
              >
                <div className="app-card-top">
                  <div>
                    <p className="app-card-mode">{applicationModeLabel(application.mode)}</p>
                    <h3>{application.name}</h3>
                    <p className="app-card-host">{application.hostname}</p>
                  </div>
                  <div className="badge-column">
                    <span className={healthBadgeClass(application.health)} title={application.health?.detail ?? health.description}>
                      {health.label}
                    </span>
                    <span className={statusBadgeClass(application.status)}>{status.label}</span>
                  </div>
                </div>

                <p className="app-card-copy">{buildAttentionSummary(application)}</p>

                <div className="app-card-meta">
                  <span>commit {shortCommit(application.current_commit)}</span>
                  <span>{application.has_update ? "更新あり" : "最新"}</span>
                  <span>{formatRelative(application.updated_at)}</span>
                </div>

                {activeJob ? (
                  <div className="inline-job-banner">
                    <span className={jobStatusBadgeClass(activeJob.status)}>
                      {jobTypeLabel(activeJob.type)} / {jobStatusLabel(activeJob.status)}
                    </span>
                    <p>{activeJob.message ?? "ジョブを実行しています。"}</p>
                  </div>
                ) : null}

                <div className="app-card-footer">
                  <div className="app-card-details">
                    <span title={status.description}>状態メモ: {status.description}</span>
                    {application.health?.response_time_ms ? (
                      <span>応答 {application.health.response_time_ms}ms</span>
                    ) : (
                      <span>{health.description}</span>
                    )}
                    {lockReason ? <span className="text-warn">{lockReason}</span> : null}
                  </div>
                  <div className="spotlight-actions">
                    <a className="button tiny ghost" href={`http://${application.hostname}`} target="_blank" rel="noreferrer">
                      公開 URL
                    </a>
                    <button type="button" className="button tiny primary" onClick={() => onOpenDetail(application.application_id)}>
                      詳細
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

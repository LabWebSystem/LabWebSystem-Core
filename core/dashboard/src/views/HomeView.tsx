import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiGitBranch,
  FiGlobe,
  FiLayers,
  FiRefreshCw,
  FiServer,
  FiShield,
  FiXCircle
} from "react-icons/fi";
import type { ApplicationJob, ApplicationListItem, SystemEvent, SystemStatus } from "../types";
import { buildAttentionSummary, formatRelative, healthMeta, jobStatusLabel, jobTypeLabel, shortCommit, toLocale } from "../ui";

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenDetail: (applicationId: string) => void;
};

function metricTone(kind: "ok" | "warn" | "error" | "neutral"): string {
  if (kind === "ok") {
    return "border-emerald-200/80 bg-emerald-50/80 text-emerald-900";
  }
  if (kind === "warn") {
    return "border-amber-200/80 bg-amber-50/80 text-amber-900";
  }
  if (kind === "error") {
    return "border-rose-200/80 bg-rose-50/80 text-rose-900";
  }
  return "border-slate-200/80 bg-white/90 text-slate-900";
}

function eventTone(level: SystemEvent["level"]): string {
  if (level === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (level === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function jobTone(status: ApplicationJob["status"]): string {
  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "running") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "queued") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function infrastructureStatus(system: SystemStatus | null) {
  const failed = system?.applicationSummary.failed ?? 0;
  const degraded = system?.applicationSummary.degraded ?? 0;

  if (failed > 0) {
    return {
      label: `異常 ${failed} 件`,
      tone: "border-rose-200 bg-rose-50 text-rose-700"
    };
  }
  if (degraded > 0) {
    return {
      label: `要確認 ${degraded} 件`,
      tone: "border-amber-200 bg-amber-50 text-amber-700"
    };
  }
  return {
    label: "安定稼働中",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };
}

export function HomeView(props: HomeViewProps) {
  const { system, applications, jobs, events, onOpenApplications, onOpenDetail } = props;

  const healthyCount = applications.filter((application) => application.health?.severity === "ok").length;
  const warningCount = applications.filter((application) => application.health?.severity === "warning").length;
  const criticalCount = applications.filter((application) => application.health?.severity === "critical").length;
  const queuedJobs = jobs.filter((job) => job.status === "queued").length;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").slice(0, 5);
  const attentionApps = applications
    .filter((application) => {
      const severity = application.health?.severity;
      return severity === "critical" || severity === "warning" || application.status === "Failed";
    })
    .slice(0, 5);
  const recentEvents = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  const recentApps = [...applications].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);
  const status = infrastructureStatus(system);
  const dnsRelay = system?.dnsServer?.relay;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-1">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <article className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_58%,#134e4a_100%)] p-6 text-white shadow-[0_34px_80px_-56px_rgba(15,23,42,0.9)]">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),rgba(255,255,255,0)_65%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-white/72">
                Overview
              </span>
              <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-semibold text-white/84">
                {status.label}
              </span>
            </div>

            <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-[2rem]">
              アプリ運用、ジョブ実行、インフラ公開状態を一画面で把握できます。
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
              稼働状況の変化、公開設定の異常、直近イベントをまとめて確認できるように、監視と運用の入口を整理しました。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/14 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/56">公開ドメイン</p>
                <p className="mt-2 truncate text-sm font-semibold">{system?.execution?.rootDomain ?? "lab.localhost"}</p>
              </div>
              <div className="rounded-2xl border border-white/14 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/56">メインホスト</p>
                <p className="mt-2 text-sm font-semibold">{system?.execution?.mainServiceIp ?? "未取得"}</p>
              </div>
              <div className="rounded-2xl border border-white/14 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/56">DNS 状態</p>
                <p className="mt-2 text-sm font-semibold">
                  {system?.dnsServer?.enabled ? (system.dnsServer.udpListening ? "待受中" : "起動済み / 要確認") : "未使用"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                onClick={onOpenApplications}
              >
                アプリ一覧へ
                <FiArrowRight className="h-4 w-4" />
              </button>
              <span className="text-xs text-white/70">最終更新 {toLocale(system?.generatedAt)}</span>
            </div>
          </div>
        </article>

        <article className="rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98))] p-5 shadow-[0_28px_70px_-56px_rgba(15,23,42,0.55)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Operations</p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">現在のオペレーション状況</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">ジョブキュー</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{queuedJobs + runningJobs}</p>
                </div>
                <FiRefreshCw className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-700">待機 {queuedJobs}</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">実行中 {runningJobs}</span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-700">失敗 {jobs.filter((job) => job.status === "failed").length}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <FiShield className="h-4 w-4" />
                  <p className="text-sm font-semibold">公開経路</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  DNS {system?.dnsServer?.enabled ? "有効" : "無効"} / relay{" "}
                  {dnsRelay?.required ? (dnsRelay.udpReachable || dnsRelay.tcpReachable ? "到達可能" : "要確認") : "不要"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <FiGitBranch className="h-4 w-4" />
                  <p className="text-sm font-semibold">最近の変化</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  直近イベント {recentEvents.length} 件 / 追加アプリ {recentApps.length} 件を表示中
                </p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className={`rounded-[1.5rem] border p-5 shadow-[0_24px_60px_-52px_rgba(15,23,42,0.55)] ${metricTone("neutral")}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">登録アプリ</p>
              <p className="mt-3 text-3xl font-bold">{applications.length}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FiLayers className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">{system?.applicationSummary.running ?? 0} 件が公開状態で稼働中です。</p>
        </article>

        <article className={`rounded-[1.5rem] border p-5 shadow-[0_24px_60px_-52px_rgba(15,23,42,0.55)] ${metricTone("ok")}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600/80">Healthy</p>
              <p className="mt-3 text-3xl font-bold">{healthyCount}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <FiCheckCircle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-sm text-emerald-700/80">応答とコンテナ状態が安定しているアプリです。</p>
        </article>

        <article className={`rounded-[1.5rem] border p-5 shadow-[0_24px_60px_-52px_rgba(15,23,42,0.55)] ${metricTone("warn")}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-600/80">Warning</p>
              <p className="mt-3 text-3xl font-bold">{warningCount}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <FiAlertTriangle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-sm text-amber-700/80">レスポンス低下や画面確認が必要な状態です。</p>
        </article>

        <article className={`rounded-[1.5rem] border p-5 shadow-[0_24px_60px_-52px_rgba(15,23,42,0.55)] ${metricTone("error")}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-600/80">Critical</p>
              <p className="mt-3 text-3xl font-bold">{criticalCount}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <FiXCircle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-sm text-rose-700/80">到達不可や実行エラーで優先対応が必要です。</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="flex min-h-0 flex-col gap-6">
          <article className="rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_26px_64px_-54px_rgba(15,23,42,0.48)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Infrastructure</p>
                <h3 className="mt-2 text-lg font-bold text-slate-950">公開インフラ基本情報</h3>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <FiServer className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">メイン IP</p>
                </div>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-900">{system?.execution?.mainServiceIp ?? "未取得"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <FiActivity className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">SSH / 補助 IP</p>
                </div>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-900">{system?.execution?.sshServiceIp ?? "未取得"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <FiGlobe className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">ルートドメイン</p>
                </div>
                <p className="mt-2 break-all text-sm font-semibold text-slate-900">{system?.execution?.rootDomain ?? "lab.localhost"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">DNS サーバー</p>
                <p className="mt-2 text-sm text-slate-600">
                  {system?.dnsServer?.enabled ? `bind ${system.dnsServer.bindHost}:${system.dnsServer.port}` : "ダッシュボードでは未使用"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${system?.dnsServer?.udpListening ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    UDP {system?.dnsServer?.udpListening ? "LISTEN" : "OFF"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${system?.dnsServer?.tcpListening ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    TCP {system?.dnsServer?.tcpListening ? "LISTEN" : "OFF"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">relay 到達性</p>
                <p className="mt-2 text-sm text-slate-600">
                  {dnsRelay?.required ? `${dnsRelay.targetHost}:${dnsRelay.targetPort}` : "relay は不要です"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${dnsRelay?.udpReachable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    UDP {dnsRelay?.udpReachable ? "OK" : "N/A"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${dnsRelay?.tcpReachable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    TCP {dnsRelay?.tcpReachable ? "OK" : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_26px_64px_-54px_rgba(15,23,42,0.48)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Attention</p>
                <h3 className="mt-2 text-lg font-bold text-slate-950">優先的に見たいアプリ</h3>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 transition hover:text-teal-800"
                onClick={onOpenApplications}
              >
                一覧を開く
                <FiArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {attentionApps.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">優先対応が必要なアプリはありません。</p>
              ) : null}
              {attentionApps.map((application) => {
                const health = healthMeta(application.health);

                return (
                  <button
                    key={application.application_id}
                    type="button"
                    className="group rounded-[1.35rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 text-left transition hover:border-teal-200 hover:shadow-[0_22px_50px_-38px_rgba(15,118,110,0.5)]"
                    onClick={() => onOpenDetail(application.application_id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-teal-800">{application.name}</span>
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {health.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-sm text-slate-500">{application.hostname}</p>
                      </div>
                      <FiExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-teal-700" />
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{buildAttentionSummary(application)}</p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{formatRelative(application.updated_at)}</span>
                      <span>{shortCommit(application.current_commit)}</span>
                      {application.health?.response_time_ms ? <span>{application.health.response_time_ms}ms</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </article>
        </div>

        <div className="flex min-h-0 flex-col gap-6">
          <article className="rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_26px_64px_-54px_rgba(15,23,42,0.48)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Queue</p>
                <h3 className="mt-2 text-lg font-bold text-slate-950">失敗または注目中のジョブ</h3>
              </div>
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{failedJobs.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {failedJobs.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">失敗ジョブはありません。</p>
              ) : null}
              {failedJobs.map((job) => (
                <div key={job.job_id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{job.application_name ?? "システム"}</p>
                      <p className="mt-1 text-xs text-slate-500">{jobTypeLabel(job.type)}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${jobTone(job.status)}`}>{jobStatusLabel(job.status)}</span>
                  </div>
                  {job.message ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">{job.message}</p> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_26px_64px_-54px_rgba(15,23,42,0.48)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">New Apps</p>
                <h3 className="mt-2 text-lg font-bold text-slate-950">最近追加されたアプリ</h3>
              </div>
              <FiClock className="h-4 w-4 text-slate-400" />
            </div>

            <div className="mt-4 space-y-3">
              {recentApps.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">アプリはまだ登録されていません。</p>
              ) : null}
              {recentApps.map((application) => (
                <button
                  key={application.application_id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-[1.25rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 text-left transition hover:border-teal-200 hover:shadow-[0_18px_40px_-34px_rgba(15,118,110,0.45)]"
                  onClick={() => onOpenDetail(application.application_id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{application.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatRelative(application.created_at)}</p>
                  </div>
                  <FiArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_26px_64px_-54px_rgba(15,23,42,0.48)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Timeline</p>
            <h3 className="mt-2 text-lg font-bold text-slate-950">システムイベント</h3>
            <p className="mt-1 text-sm text-slate-500">新しい順で直近のイベントを表示しています。</p>
          </div>
          <span className="text-sm font-semibold text-slate-500">{recentEvents.length} 件表示</span>
        </div>

        {recentEvents.length === 0 ? <p className="mt-4 text-sm text-slate-500">イベントはまだありません。</p> : null}

        {recentEvents.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {recentEvents.map((event) => (
              <article
                key={event.event_id}
                className="grid gap-3 rounded-[1.35rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 md:grid-cols-[170px_minmax(0,1fr)]"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500">{toLocale(event.created_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${eventTone(event.level)}`}>{event.level}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{event.scope ?? "system"}</span>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{event.title}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        {event.application_name ? <span>{event.application_name}</span> : null}
                        {event.application_id ? <span>{event.application_id}</span> : null}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.message}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

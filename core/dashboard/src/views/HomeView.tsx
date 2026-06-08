import {
  FaCircleCheck,
  FaClockRotateLeft,
  FaCubes,
  FaHourglassHalf,
  FaNetworkWired,
  FaShieldHalved,
  FaTriangleExclamation
} from "react-icons/fa6";
import type { ApplicationJob, ApplicationListItem, SystemEvent, SystemStatus } from "../types";
import { buildAttentionSummary, formatRelative, healthMeta, toLocale } from "../ui";

type HomeViewProps = {
  system: SystemStatus | null;
  applications: ApplicationListItem[];
  jobs: ApplicationJob[];
  events: SystemEvent[];
  onOpenApplications: () => void;
  onOpenEvents: () => void;
  onOpenDetail: (applicationId: string) => void;
};

function eventTone(level: SystemEvent["level"]): string {
  if (level === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (level === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function HomeView(props: HomeViewProps) {
  const { system, applications, jobs, events, onOpenApplications, onOpenEvents, onOpenDetail } = props;

  const runningCount = applications.filter((application) => application.health?.severity === "ok").length;
  const issueCount = applications.filter((application) => {
    const severity = application.health?.severity;
    return severity === "warning" || severity === "critical" || application.status === "Failed";
  }).length;
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  const criticalApps = applications
    .filter((application) => {
      const severity = application.health?.severity;
      return severity === "critical" || severity === "warning" || application.status === "Failed";
    })
    .slice(0, 6);
  const recentEvents = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  const dnsHealthy = Boolean(system?.dnsServer?.enabled && (system.dnsServer.udpListening || system.dnsServer.tcpListening));

  return (
    <div className="space-y-6 p-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">稼働アプリ数</p>
            <p className="mt-1.5 text-3xl font-bold text-slate-900">{applications.length}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-lg text-slate-500">
            <FaCubes />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">正常起動中</p>
            <p className="mt-1.5 text-3xl font-bold text-emerald-600">{runningCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100/50 bg-emerald-50 text-lg text-emerald-500">
            <FaCircleCheck />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">警告・異常</p>
            <p className="mt-1.5 text-3xl font-bold text-rose-500">{issueCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-100/50 bg-rose-50 text-lg text-rose-500">
            <FaTriangleExclamation />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">待機中ジョブ</p>
            <p className="mt-1.5 text-3xl font-bold text-amber-500">{queuedCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-100/50 bg-amber-50 text-lg text-amber-500">
            <FaHourglassHalf />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <FaNetworkWired className="text-base text-slate-400" />
                インフラストラクチャ基本情報
              </h3>
              <span className="font-mono text-xs text-slate-400">{toLocale(system?.generatedAt)}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="mb-1 block text-xs font-semibold text-slate-400">メインホストIP</span>
                <span className="font-mono font-bold text-slate-800">{system?.execution?.mainServiceIp ?? "---.---.---.---"}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="mb-1 block text-xs font-semibold text-slate-400">DNS サーバー状態</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${dnsHealthy ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <span className="font-bold text-slate-800">{dnsHealthy ? "稼働中" : "要確認"}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="mb-1 block text-xs font-semibold text-slate-400">ルートドメイン</span>
                <span className="font-mono font-bold text-slate-800">{system?.execution?.rootDomain ?? "---.---"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <FaShieldHalved className="text-base text-rose-500" />
                要確認アプリケーション
              </h3>
              <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenApplications}>
                一覧表示
              </button>
            </div>

            <div className="space-y-3">
              {criticalApps.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">注意が必要なアプリケーションはありません</p>
              ) : null}
              {criticalApps.map((application) => {
                const health = healthMeta(application.health);
                return (
                  <button
                    key={application.application_id}
                    type="button"
                    onClick={() => onOpenDetail(application.application_id)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-800">{application.name}</p>
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {health.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-400">{application.hostname}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-400">{formatRelative(application.updated_at)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{buildAttentionSummary(application)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex h-[350px] flex-col rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <FaClockRotateLeft className="text-base text-slate-400" />
              イベント履歴
            </h3>
            <button type="button" className="text-sm font-semibold text-violet-600 hover:text-violet-700" onClick={onOpenEvents}>
              一覧表示
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {recentEvents.length === 0 ? <p className="text-sm text-slate-400">イベントはまだありません。</p> : null}
            {recentEvents.map((event) => (
              <article key={event.event_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${eventTone(event.level)}`}>{event.level}</span>
                  <span className="text-[11px] text-slate-400">{toLocale(event.created_at)}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-800">{event.title}</p>
                {event.application_name ? <p className="mt-1 text-xs text-slate-400">{event.application_name}</p> : null}
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{event.message}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

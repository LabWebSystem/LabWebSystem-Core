import type { ReactNode } from "react";
import { FaChartPie, FaClockRotateLeft, FaCube, FaListCheck, FaRotate, FaServer } from "react-icons/fa6";
import { VscVscode } from "react-icons/vsc";
import type { SystemStatus } from "../types";

export type DashboardView = "home" | "apps" | "events" | "import" | "detail";

type DashboardShellProps = {
  activeView: DashboardView;
  executionMode: "dry-run" | "execute" | null;
  system: SystemStatus | null;
  sshServiceIp: string | null;
  selectedApplicationName: string | null;
  loading: boolean;
  refreshing: boolean;
  activeJobsCount: number;
  failedJobsCount: number;
  onNavigate: (view: DashboardView) => void;
  onReload: () => void;
  onSyncInfrastructure: () => void;
  onToggleJobsPanel: () => void;
  children: ReactNode;
  jobsPanel: ReactNode;
};

const vscodeRemoteUser = "amoeba";
const vscodeWorkspacePath = "/home/arpanet/work/LabWebSystem-Core";

function currentViewTitle(activeView: DashboardView): string {
  if (activeView === "apps") {
    return "APPLICATIONS";
  }
  if (activeView === "events") {
    return "EVENTS";
  }
  if (activeView === "import") {
    return "IMPORT";
  }
  if (activeView === "detail") {
    return "APP DETAIL";
  }
  return "OVERVIEW";
}

function statusMeta(system: SystemStatus | null, loading: boolean, refreshing: boolean, failedJobsCount: number) {
  if (loading || refreshing) {
    return {
      dot: "bg-sky-500",
      ping: "bg-sky-400",
      text: "データ同期中"
    };
  }

  if ((system?.applicationSummary.failed ?? 0) > 0) {
    return {
      dot: "bg-rose-500",
      ping: "bg-rose-400",
      text: "システム異常あり"
    };
  }

  if ((system?.applicationSummary.degraded ?? 0) > 0 || failedJobsCount > 0) {
    return {
      dot: "bg-amber-500",
      ping: "bg-amber-400",
      text: "要確認項目あり"
    };
  }

  return {
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
    text: "システム正常動作中"
  };
}

export function DashboardShell(props: DashboardShellProps) {
  const {
    activeView,
    executionMode,
    system,
    sshServiceIp,
    selectedApplicationName,
    loading,
    refreshing,
    activeJobsCount,
    failedJobsCount,
    onNavigate,
    onReload,
    onSyncInfrastructure,
    onToggleJobsPanel,
    children,
    jobsPanel
  } = props;

  const navActive = activeView === "events" ? "events" : activeView === "home" ? "home" : "apps";
  const status = statusMeta(system, loading, refreshing, failedJobsCount);
  const vscodeRemoteTarget = sshServiceIp?.trim().length
    ? `ssh-remote+${vscodeRemoteUser}@${sshServiceIp.trim()}`
    : null;
  const vscodeUrl = vscodeRemoteTarget
    ? `vscode://vscode-remote/${vscodeRemoteTarget}${vscodeWorkspacePath}`
    : null;

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-800">
      <aside className="z-20 flex w-16 shrink-0 flex-col items-center justify-between border-r border-slate-200/80 bg-white py-4">
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-500 to-violet-700 text-white shadow-sm shadow-violet-500/30">
            <FaCube className="text-xl" />
          </div>

          <nav className="flex w-full flex-col gap-2.5 px-2">
            <button
              type="button"
              onClick={() => onNavigate("home")}
              title="概要"
              className={`flex h-12 w-full items-center justify-center rounded-xl transition-all duration-200 ${
                navActive === "home" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              }`}
            >
              <FaChartPie className="text-xl" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("apps")}
              title="アプリケーション一覧"
              className={`flex h-12 w-full items-center justify-center rounded-xl transition-all duration-200 ${
                navActive === "apps" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              }`}
            >
              <FaServer className="text-xl" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("events")}
              title="システムイベント"
              className={`flex h-12 w-full items-center justify-center rounded-xl transition-all duration-200 ${
                navActive === "events" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              }`}
            >
              <FaClockRotateLeft className="text-xl" />
            </button>
          </nav>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <button
            type="button"
            onClick={onSyncInfrastructure}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-violet-50 hover:text-violet-600"
            title="外部公開設定同期"
            disabled={loading}
          >
            <FaRotate className="text-lg" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-500">
            AD
          </div>
        </div>
      </aside>

      <main className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/85 bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{currentViewTitle(activeView)}</span>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.ping} opacity-75`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status.dot}`} />
              </span>
              <span className="text-sm font-semibold text-slate-500">
                {activeView === "detail" && selectedApplicationName ? `${selectedApplicationName} / ` : ""}
                {status.text}
                {executionMode ? ` / ${executionMode}` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeJobsCount > 0 ? (
              <button
                type="button"
                onClick={onToggleJobsPanel}
                className="flex items-center gap-1.5 rounded-full border border-amber-200/50 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <FaRotate className="animate-spin text-xs" />
                <span className="mx-0.5">{activeJobsCount}</span>件の処理中
              </button>
            ) : null}

            {vscodeUrl ? (
              <a
                href={vscodeUrl}
                className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                title={`${vscodeRemoteUser}@${sshServiceIp?.trim()} に VS Code Remote-SSH で接続`}
              >
                <VscVscode className="text-base text-sky-600" />
                <span>VS Codeで開く</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-300"
                title="SSH 接続先 IP が取得できないため VS Code を起動できません"
              >
                <VscVscode className="text-base" />
                <span>VS Codeで開く</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleJobsPanel}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800 active:scale-95"
              title="ジョブパネルを開く"
            >
              <FaListCheck className="text-sm" />
              {failedJobsCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
                  {Math.min(failedJobsCount, 9)}
                </span>
              ) : null}
              {activeJobsCount > 0 ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500 ring-2 ring-white" /> : null}
            </button>

            <button
              type="button"
              onClick={onReload}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800 active:scale-95"
              title="データを強制再取得"
            >
              <FaRotate className={`text-sm ${loading || refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50">{children}</div>
      </main>

      {jobsPanel}
    </div>
  );
}

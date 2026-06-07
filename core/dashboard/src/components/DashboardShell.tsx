import type { ReactNode } from "react";
import { FiActivity, FiDatabase, FiGrid, FiLayers, FiPlusSquare, FiRefreshCw, FiSidebar, FiWifi } from "react-icons/fi";

export type DashboardView = "home" | "apps" | "import" | "detail";

type DashboardShellProps = {
  activeView: DashboardView;
  detailEnabled: boolean;
  executionMode: "dry-run" | "execute" | null;
  loading: boolean;
  activeJobsCount: number;
  failedJobsCount: number;
  onNavigate: (view: DashboardView) => void;
  onReload: () => void;
  onSyncInfrastructure: () => void;
  onToggleJobsPanel: () => void;
  children: ReactNode;
  jobsPanel: ReactNode;
};

const tabs: Array<{ key: DashboardView; label: string; icon: typeof FiGrid }> = [
  { key: "home", label: "ホーム", icon: FiGrid },
  { key: "apps", label: "アプリ", icon: FiLayers },
  { key: "import", label: "追加", icon: FiPlusSquare },
  { key: "detail", label: "詳細", icon: FiDatabase }
];

export function DashboardShell(props: DashboardShellProps) {
  const {
    activeView,
    detailEnabled,
    executionMode,
    loading,
    activeJobsCount,
    failedJobsCount,
    onNavigate,
    onReload,
    onSyncInfrastructure,
    onToggleJobsPanel,
    children,
    jobsPanel
  } = props;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(228,240,247,0.95),_rgba(240,246,250,0.85)_32%,_rgba(247,244,239,0.92)_100%)] text-slate-900">
      <div className="flex min-h-screen w-full flex-col gap-3 px-2 py-2 md:px-3 md:py-3">
        <header className="rounded-[28px] border border-white/70 bg-white/85 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                <FiActivity className="h-3.5 w-3.5" />
                <span>Lab-Core v3</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">運用ダッシュボード</h1>
                {executionMode ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    <FiWifi className="h-3.5 w-3.5" />
                    {executionMode === "dry-run" ? "dry-run" : "execute"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={onToggleJobsPanel}
              >
                <FiSidebar className="h-4 w-4" />
                <span>ジョブ</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {activeJobsCount}
                  {failedJobsCount > 0 ? ` / ${failedJobsCount}` : ""}
                </span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={onSyncInfrastructure}
                disabled={loading}
              >
                <FiWifi className="h-4 w-4" />
                DNS/Proxy 同期
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={onReload}
                disabled={loading}
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "更新中" : "更新"}
              </button>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 rounded-[24px] border border-white/70 bg-white/80 p-2 shadow-[0_14px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl" aria-label="画面遷移">
          {tabs.map((tab) => {
            const disabled = tab.key === "detail" && !detailEnabled;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                  activeView === tab.key
                    ? "bg-slate-950 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                onClick={() => onNavigate(tab.key)}
                disabled={disabled}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <main className="min-h-0 flex-1 overflow-auto rounded-[30px] border border-white/70 bg-white/80 p-4 shadow-[0_24px_56px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-5">
          {children}
        </main>
      </div>

      {jobsPanel}
    </div>
  );
}

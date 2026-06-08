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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 shadow-[0_12px_38px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-3 text-indigo-600">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.7)]">
                <FiActivity className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Dashboard</p>
                <span className="block truncate text-lg font-bold tracking-tight text-slate-900">Lab-Core v3</span>
              </div>
            </div>
            {executionMode ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
                <FiWifi className="h-3.5 w-3.5" />
                {executionMode}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={onToggleJobsPanel}
            >
              <FiSidebar className="h-4 w-4" />
              <span className="hidden sm:inline">ジョブ</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {activeJobsCount}
                {failedJobsCount > 0 ? ` / ${failedJobsCount}` : ""}
              </span>
            </button>
            <button
              type="button"
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
              onClick={onSyncInfrastructure}
              disabled={loading}
            >
              <FiWifi className="h-4 w-4" />
              DNS同期
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-[0_20px_40px_-28px_rgba(79,70,229,0.8)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onReload}
              disabled={loading}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{loading ? "更新中" : "更新"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
        <aside className="w-full shrink-0 md:w-56">
          <nav
            className="flex gap-1 overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white/90 p-2 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur md:flex-col md:overflow-visible"
            aria-label="メインナビゲーション"
          >
            {tabs.map((tab) => {
              const disabled = tab.key === "detail" && !detailEnabled;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition whitespace-nowrap ${
                    activeView === tab.key
                      ? "bg-slate-900 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  onClick={() => onNavigate(tab.key)}
                  disabled={disabled}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      activeView === tab.key ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-auto rounded-[1.75rem] border border-slate-200 bg-white/88 p-4 shadow-[0_32px_80px_-54px_rgba(15,23,42,0.55)] backdrop-blur sm:p-6">
          {children}
        </main>
      </div>

      {jobsPanel}
    </div>
  );
}

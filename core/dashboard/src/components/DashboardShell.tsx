import type { ReactNode } from "react";
import {
  FiActivity,
  FiDatabase,
  FiGrid,
  FiLayers,
  FiPlusSquare,
  FiRefreshCw,
  FiSidebar,
  FiWifi
} from "react-icons/fi";
import type { SystemStatus } from "../types";
import { toLocale } from "../ui";

export type DashboardView = "home" | "apps" | "import" | "detail";

type DashboardShellProps = {
  activeView: DashboardView;
  detailEnabled: boolean;
  selectedApplicationName: string | null;
  executionMode: "dry-run" | "execute" | null;
  system: SystemStatus | null;
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

const tabs: Array<{ key: DashboardView; label: string; shortLabel: string; icon: typeof FiGrid }> = [
  { key: "home", label: "概要", shortLabel: "Overview", icon: FiGrid },
  { key: "apps", label: "アプリ一覧", shortLabel: "Apps", icon: FiLayers },
  { key: "import", label: "アプリ追加", shortLabel: "Import", icon: FiPlusSquare },
  { key: "detail", label: "詳細管理", shortLabel: "Detail", icon: FiDatabase }
];

function buildViewMeta(activeView: DashboardView, selectedApplicationName: string | null) {
  switch (activeView) {
    case "apps":
      return {
        shortLabel: "Applications",
        title: "アプリケーション一覧",
        description: "登録済みアプリの状態確認と遷移を行います。"
      };
    case "import":
      return {
        shortLabel: "Import",
        title: "アプリ追加",
        description: "GitHub ソースと compose 情報から新規アプリを登録します。"
      };
    case "detail":
      return {
        shortLabel: "Detail",
        title: selectedApplicationName ? `${selectedApplicationName} の詳細` : "詳細管理",
        description: "選択したアプリの運用状態、デプロイ設定、ログを管理します。"
      };
    default:
      return {
        shortLabel: "Overview",
        title: "運用ダッシュボード",
        description: "システム全体の状態、注意点、最近のイベントを俯瞰できます。"
      };
  }
}

function buildSystemBadge(system: SystemStatus | null, loading: boolean, refreshing: boolean, failedJobsCount: number) {
  if (loading || refreshing) {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-700",
      dot: "bg-sky-500",
      label: "データ同期中"
    };
  }

  const failed = system?.applicationSummary.failed ?? 0;
  const degraded = system?.applicationSummary.degraded ?? 0;

  if (failed > 0) {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      dot: "bg-rose-500",
      label: `異常 ${failed} 件`
    };
  }

  if (degraded > 0 || failedJobsCount > 0) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      label: `要確認 ${degraded + failedJobsCount} 件`
    };
  }

  return {
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    label: "システム正常動作中"
  };
}

export function DashboardShell(props: DashboardShellProps) {
  const {
    activeView,
    detailEnabled,
    selectedApplicationName,
    executionMode,
    system,
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

  const viewMeta = buildViewMeta(activeView, selectedApplicationName);
  const systemBadge = buildSystemBadge(system, loading, refreshing, failedJobsCount);

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7f7f2_0%,#eef2f7_52%,#e8edf3_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(13,148,136,0.18),rgba(13,148,136,0)_70%)]" />
        <div className="absolute right-[-8%] top-[10%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.18),rgba(245,158,11,0)_72%)]" />
        <div className="absolute bottom-[-12%] left-[20%] h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.16),rgba(148,163,184,0)_72%)]" />
      </div>

      <div className="relative flex min-h-screen flex-col md:flex-row">
        <aside className="z-20 border-b border-slate-200/80 bg-white/88 px-3 py-3 backdrop-blur-xl md:flex md:w-20 md:shrink-0 md:flex-col md:justify-between md:border-b-0 md:border-r md:px-0 md:py-4">
          <div className="flex items-center justify-between gap-4 md:flex-col md:justify-start md:gap-6">
            <div className="flex items-center gap-3 md:flex-col">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.72)]">
                <FiActivity className="h-5 w-5" />
              </div>
              <div className="md:hidden">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Lab-Core</p>
                <p className="text-sm font-semibold text-slate-900">Dashboard</p>
              </div>
            </div>

            <nav className="flex min-w-0 flex-1 items-center justify-end gap-2 md:w-full md:flex-none md:flex-col md:px-2" aria-label="メインナビゲーション">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const disabled = tab.key === "detail" && !detailEnabled;
                const active = activeView === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    title={tab.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition md:h-12 md:w-12 md:justify-center md:px-0 ${
                      active
                        ? "bg-slate-900 text-white shadow-[0_22px_44px_-30px_rgba(15,23,42,0.82)]"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-35`}
                    onClick={() => onNavigate(tab.key)}
                    disabled={disabled}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="md:hidden">{tab.label}</span>
                    <span className="sr-only">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-3 hidden items-center justify-center md:flex">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-teal-700"
              onClick={onSyncInfrastructure}
              disabled={loading}
              title="DNS / Proxy 同期"
            >
              <FiWifi className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="z-10 border-b border-slate-200/80 bg-white/84 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-slate-400">{viewMeta.shortLabel}</span>
                  {executionMode ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      <FiWifi className="h-3.5 w-3.5" />
                      {executionMode}
                    </span>
                  ) : null}
                  <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${systemBadge.tone}`}>
                    <span className={`h-2 w-2 rounded-full ${systemBadge.dot}`} />
                    {systemBadge.label}
                  </span>
                </div>
                <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-950">{viewMeta.title}</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">{viewMeta.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                  onClick={onToggleJobsPanel}
                >
                  <FiSidebar className="h-4 w-4" />
                  <span>{activeJobsCount} 件処理中</span>
                  {failedJobsCount > 0 ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-rose-600">{failedJobsCount} failed</span>
                  ) : null}
                </button>

                <button
                  type="button"
                  className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex"
                  onClick={onSyncInfrastructure}
                  disabled={loading}
                >
                  <FiWifi className="h-4 w-4" />
                  <span>設定同期</span>
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_20px_40px_-28px_rgba(15,23,42,0.8)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={onReload}
                  disabled={loading}
                >
                  <FiRefreshCw className={`h-4 w-4 ${loading || refreshing ? "animate-spin" : ""}`} />
                  <span>{loading ? "更新中" : "更新"}</span>
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span>最終集計: {toLocale(system?.generatedAt)}</span>
              <span>稼働中アプリ: {system?.applicationSummary.running ?? 0}</span>
              <span>待機ジョブ: {system?.jobSummary.queued ?? 0}</span>
              <span>実行ジョブ: {system?.jobSummary.running ?? 0}</span>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-5 sm:py-5">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/75 bg-white/76 shadow-[0_36px_90px_-58px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70 backdrop-blur-xl">
              <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5 lg:p-6">{children}</div>
            </div>
          </main>
        </div>
      </div>

      {jobsPanel}
    </div>
  );
}

import type { ReactNode } from "react";

export type DashboardView = "home" | "apps" | "import" | "detail";

type DashboardShellProps = {
  activeView: DashboardView;
  detailEnabled: boolean;
  executionMode: "dry-run" | "execute" | null;
  loading: boolean;
  onNavigate: (view: DashboardView) => void;
  onReload: () => void;
  onSyncInfrastructure: () => void;
  children: ReactNode;
};

const tabs: Array<{ key: DashboardView; label: string }> = [
  { key: "home", label: "ホーム" },
  { key: "apps", label: "アプリ一覧" },
  { key: "import", label: "アプリ登録" },
  { key: "detail", label: "アプリ詳細" }
];

export function DashboardShell(props: DashboardShellProps) {
  const { activeView, detailEnabled, executionMode, loading, onNavigate, onReload, onSyncInfrastructure, children } = props;

  return (
    <div className="dashboard-page">
      <header className="topbar card-surface">
        <div className="topbar-main">
          <p className="eyebrow">LAB-CORE v3</p>
          <h1>運用ダッシュボード</h1>
          <p className="topbar-sub">アプリ状態、ジョブ進行、エラー履歴を一つの画面系で追える運用 UI です。</p>
          {executionMode ? (
            <p className="mode-chip">実行モード: {executionMode === "dry-run" ? "dry-run" : "execute"}</p>
          ) : null}
        </div>
        <div className="topbar-actions">
          <button type="button" className="button secondary" onClick={onSyncInfrastructure} disabled={loading}>
            DNS/Proxy 同期
          </button>
          <button type="button" className="button secondary" onClick={onReload} disabled={loading}>
            {loading ? "更新中..." : "最新状態に更新"}
          </button>
        </div>
      </header>

      <nav className="view-tabs card-surface" aria-label="画面遷移">
        {tabs.map((tab) => {
          const disabled = tab.key === "detail" && !detailEnabled;
          return (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${activeView === tab.key ? "active" : ""}`}
              onClick={() => onNavigate(tab.key)}
              disabled={disabled}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <main className="view-area card-surface">{children}</main>
    </div>
  );
}

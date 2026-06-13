# 実装計画

1. 提供された `grid-dashboard-module.zip` と更新仕様書を確認し、既存ダッシュボードの guardrails 依存箇所を特定する。
2. モジュール本体を `core/dashboard/src/dashboard/gridModule` へ取り込み、既存保存形式との橋渡しを行うアダプタ層を追加する。
3. `layout.ts` と `useDashboardWorkspace.ts` を新アダプタ経由へ差し替え、追加・削除・ページ移動・修復の経路を一本化する。
4. `HomeView.tsx` のドラッグページ遷移判定を新仕様寄りに調整し、表示密度判定も新モジュールのロジックへ寄せる。
5. `tsc --noEmit` と別出力先の `vite build` で検証し、作業記録を保存してコミットする。

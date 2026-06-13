# 修正内容の確認

## 1. 新モジュール導入

- `core/dashboard/src/dashboard/gridModule` を新設し、提供されたウィジェットレイアウトモジュールの core 実装を取り込んだ。
- `core/dashboard/src/dashboard/moduleAdapter.ts` を追加し、既存の `DashboardLayoutDocument` を新モジュールの座標・配置ルールへ接続した。

## 2. 既存 guardrails の置き換え

- `core/dashboard/src/dashboard/layout.ts` の `sanitizeDashboardDocument` を旧 guardrails 実装から切り離し、新アダプタ経由へ変更した。
- `core/dashboard/src/hooks/useDashboardWorkspace.ts` の追加・削除・レイアウト更新・ページ移動・ドラッグ終了時修復を新モジュール基準へ統一した。

## 3. UX ロジック調整

- `core/dashboard/src/views/HomeView.tsx` のページ切替判定を「枠内の端」ではなく「ダッシュボード外へのオーバーシュート」に寄せた。
- `core/dashboard/src/dashboard/widgetDefinitions.tsx` の表示密度判定を新モジュールの `icon / compact / summary / full` から既存 UI 用の `compact / standard / detail` へマッピングする形に変更した。

## 4. 確認結果

- `corepack yarn workspace @lab-core/dashboard exec tsc --noEmit` を実行し、型エラーがないことを確認した。
- `corepack yarn workspace @lab-core/dashboard exec vite build --emptyOutDir false --outDir build-check` を実行し、別出力先でビルド成功を確認した。
- 既定の `core/dashboard/dist` への通常 `build` は既存配信物の権限不足で失敗したため、確認は別出力先で代替した。

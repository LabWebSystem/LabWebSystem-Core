# 修正内容の確認

## 原因

- `HomeView` では `repairDashboard()` と `endWidgetDrag()` を `useEffect` の依存に含めていた
- これらの関数は毎レンダーで新しい参照になっていたため、effect が再実行され続けていた
- effect 内では `sanitizeDashboardDocument()` の結果で `setDashboard()` を呼ぶため、実質的に内容が同じでも再描画と自動保存が繰り返されていた
- その結果 `PUT /api/system/dashboard-layout` が大量発生し、ブラウザが `ERR_INSUFFICIENT_RESOURCES` を返していた

## 実施した修正

- `core/dashboard/src/hooks/useDashboardWorkspace.ts`
  - レイアウトを `JSON.stringify` した署名で比較し、内容が同じ場合は既存 state を再利用するようにした
  - `persistDashboard()` に保存済み署名と送信中署名の管理を追加し、同一レイアウトの重複送信を抑止した
  - 初期ロード時に既存保存データがある場合は、その内容を「保存済み」とみなすようにした
  - `repairDashboard` / `applyWidgetRect` / `endWidgetDrag` などを `useCallback` 化し、effect 依存で無限再実行しないようにした

## 確認結果

- `yarn build --outDir dist-check` は成功
- 通常の `yarn build` は、既存の `core/dashboard/dist/assets` が `root` 所有のため、出力掃除時に `EACCES` で失敗
- したがって、今回のソース修正自体はビルド可能だが、通常ビルドを安定させるには `dist` 配下の権限整理が別途必要

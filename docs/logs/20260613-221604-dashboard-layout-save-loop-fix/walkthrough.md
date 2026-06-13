# 修正内容の確認

## 対応内容

- `core/dashboard/src/hooks/useDashboardWorkspace.ts` の自動保存処理に、保存済みシグネチャおよび保存中シグネチャの重複抑止を追加した。
- レイアウト整形結果が前回 state と同じ場合は既存オブジェクトを返すようにし、不要な再レンダーと保存トリガーを抑止した。
- `changePage` / `updateLayouts` / `applyWidgetRect` / `repairDashboard` / `addWidget` / `deleteWidget` / `clearAllWidgets` / `beginWidgetDrag` / `shiftDraggingWidgetPage` / `endWidgetDrag` を `useCallback` 化し、`HomeView` の effect 依存で毎回別関数として扱われないようにした。
- 離脱時 `sendBeacon` でも、保存済みまたは保存中の同一レイアウトは送らないようにした。

## 原因

- `HomeView` の `useEffect` が `repairDashboard` と `endWidgetDrag` を依存に持っていた。
- これらの関数参照がレンダーごとに変わると effect が毎回再実行され、内部の `setDashboard()` によって再レンダーが連鎖していた。
- さらに整形後レイアウトが実質同一でも新しいオブジェクトとして state 更新されるため、自動保存 effect が繰り返し発火していた。

## 確認結果

- `yarn --cwd core/dashboard tsc --noEmit --pretty false` は成功した。
- `yarn --cwd core/dashboard vite build --emptyOutDir=false --outDir dist-verify` は成功した。
- 既定の `yarn --cwd core/dashboard build` は既存 `core/dashboard/dist` 配下の権限問題で `EACCES` になったため、検証は別出力先で実施した。

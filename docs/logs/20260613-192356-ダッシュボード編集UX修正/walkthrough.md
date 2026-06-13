# 修正内容の確認

## 1. 編集 UI の見直し

- `WidgetFrame.tsx` の削除ボタンをウィジェット右上のフローティング表示へ変更した。
- `HomeView.tsx` に左右上下と四隅のリサイズ判定サーフェスを追加し、ボーダー領域でサイズ変更できるようにした。
- 右下インジケータを単なる四角形から、斜線を使ったリサイズアイコン風のフローティング表示へ変更した。
- ウィジェット追加ボタンは編集モード時のみ表示するようにした。

## 2. 保存と編集完了の修正

- `useDashboardWorkspace.ts` の `applyWidgetRect` を同期結果付きへ変更した。
- `endWidgetDrag` に sanitize 実行可否を持たせ、ドロップ確定直後に保存済みレイアウトを別 sanitize で潰さないようにした。
- 編集中の操作完了後は自動保存タイマーへ自然に流れるようにした。

## 3. 重ね配置失敗時の安全化

- `moduleAdapter.ts` に `tryApplyWidgetRectOnDashboardDocument` を追加し、衝突や不正状態を例外で落とさず結果で返すようにした。
- `HomeView.tsx` で失敗時に「重ねて配置することはできません」とトースト表示するようにした。

## 4. ドラフトページの視認性

- `HomeView.tsx` でドラフトページに専用バッジを表示し、ドラフト生成中であることが分かるようにした。

## 5. 確認結果

- `corepack yarn workspace @lab-core/dashboard exec tsc --noEmit` を実行し、型エラーがないことを確認した。
- `corepack yarn workspace @lab-core/dashboard exec vite build --emptyOutDir false --outDir build-check` を実行し、ビルド成功を確認した。
- `tryApplyWidgetRectOnDashboardDocument` を使った確認スクリプトで、重ね配置失敗時に `{ applied: false, reason: "collision" }` が返ることを確認した。

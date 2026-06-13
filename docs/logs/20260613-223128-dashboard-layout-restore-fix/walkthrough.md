# 修正内容の確認

## 対応内容

- `core/dashboard/src/views/HomeView.tsx` の `maxRows` 初期値を `0` に変更し、グリッドの寸法測定が完了するまでは修復処理を走らせないようにした。
- 現在ページの各ウィジェットが `cols` や `maxRows` を実際に逸脱している場合だけ `repairDashboard()` を呼ぶようにした。
- 編集モード終了時の保存確定を `editMode: true -> false` の遷移時だけに限定し、通常表示中の不要な `endWidgetDrag()` 実行を止めた。
- `onWheel` を JSX から外し、`addEventListener("wheel", ..., { passive: false })` へ移した。

## 原因

- 初期表示時点ではグリッドの高さ測定前でも `maxRows` が `1` 扱いになっていた。
- その状態で `repairDashboard()` や `endWidgetDrag()` が動くと、レイアウト整形側で `h / minH / maxH` が 1 行へクランプされ、そのまま保存されていた。
- 保存 API はレイアウト JSON をそのまま保存しているため、崩れた値の発生源は API ではなくフロントエンドの早すぎる再整形だった。

## 確認結果

- `yarn --cwd core/dashboard tsc --noEmit --pretty false` は成功した。
- `yarn --cwd core/dashboard vite build --emptyOutDir=false --outDir dist-verify` は成功した。
- 既定の `dist` には既存の権限問題があるため、今回も検証は別出力先で実施した。

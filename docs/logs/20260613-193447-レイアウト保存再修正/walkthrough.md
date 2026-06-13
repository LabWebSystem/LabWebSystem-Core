# 修正内容の確認

## 1. 保存経路の強化

- `useDashboardWorkspace.ts` に `dashboardRef` と `flushSaveNow` を追加した。
- デバウンス保存に加えて、ウィジェット移動・追加・削除・ページ移動・編集完了時に即時保存を走らせるようにした。
- `pagehide` と `visibilitychange` で `sendBeacon` 保存を行うようにし、リロード直前でも保存を取りこぼしにくくした。

## 2. 表示修正

- `HomeView.tsx` の右下サイズ変更インジケータから円形背景を削除し、斜線のみの軽い表示へ変更した。

## 3. 確認結果

- `corepack yarn workspace @lab-core/dashboard exec tsc --noEmit` を実行し、型エラーがないことを確認した。
- `corepack yarn workspace @lab-core/dashboard exec vite build --emptyOutDir false --outDir build-check` を実行し、ビルド成功を確認した。
- 現在 DB に保存されているレイアウトは `ステータスカード` と `CPU使用率` の 2 ウィジェット状態であることを確認した。

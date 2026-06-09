# 修正内容の確認

## 概要

監視ダッシュボードを、複数ウィジェットを自由に並べ替えられるページ型ダッシュボードへ刷新した。ドラッグ移動、リサイズ、ページ切り替え、追加削除、レイアウト保存までを含めて実装している。

## 主な変更

- `core/backend/src/lib/schema.ts`
  - ダッシュボードレイアウト保存用の `dashboard_layouts` テーブルを追加
- `core/backend/src/routes/system.ts`
  - 現在の監視メトリクスを返す `/api/system/metrics` を追加
  - レイアウト保存 / 復元 API を追加
- `core/dashboard/package.json`
  - `react-grid-layout` を追加
- `core/dashboard/src/types.ts`
  - ダッシュボードウィジェット、レイアウト、監視メトリクスの型を追加
- `core/dashboard/src/api.ts`
  - メトリクス取得、レイアウト取得、レイアウト保存 API を追加
- `core/dashboard/src/views/HomeView.tsx`
  - 監視ウィジェットダッシュボードへ全面刷新
  - ページ単位スライド、ドラッグ、リサイズ、追加、削除を実装
  - CPU、メモリ、ディスク、ネットワーク、アラート、ログ、グラフ、ステータスなどをウィジェット化
- `core/dashboard/src/styles.css`
  - React-Grid-Layout のプレースホルダ、ドラッグ中表現、リサイズハンドルの見た目を調整
- `docs/readmes/ダッシュボードUIデザインルール.md`
  - 新しいウィジェット型ダッシュボードに合わせてルールを更新
- `core/dashboard/README.md`
  - 新しい監視ダッシュボード機能を追記

## 確認

- 実行コマンド: `corepack yarn workspace @lab-core/dashboard build`
- 結果: 成功
- 実行コマンド: `corepack yarn workspace @lab-core/backend build`
- 結果: 成功

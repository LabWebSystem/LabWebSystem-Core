# 修正内容の確認

## 変更の主眼

固定トピックページを前提にしていた監視ダッシュボードを、必要に応じてページを増やせる可変ページ型ワークスペースへ切り替えた。

## 実装内容

- `core/dashboard/src/types.ts`
  - ダッシュボード構造を `pages` / `currentPageId` / `pageId` ベースへ変更した
- `core/dashboard/src/views/HomeView.tsx`
  - 旧 `page/pageCount` 保存形式からの互換読み込みを追加した
  - ページ追加、空ページ削除、ウィジェットのページ移動時の新規ページ自動作成を実装した
  - ウィジェット定義を共通化し、各ウィジェットのデフォルトサイズと最小サイズを一元管理した
  - ウィジェットサイズに応じて `compact` / `standard` / `detail` の表示へ切り替えるようにした
  - 追加モーダルを実プレビュー付きに変更し、 `n×m` サイズ表記と最小サイズを表示するようにした
- `docs/readmes/ダッシュボードUIデザインルール.md`
  - 固定トピック前提を廃止し、可変ページ・最小サイズ・サイズ別表示・プレビュー必須をルール化した
- `core/dashboard/README.md`
  - 新しいダッシュボード仕様を要約として追記した

## 確認

- `corepack yarn workspace @lab-core/dashboard build`
  - 成功

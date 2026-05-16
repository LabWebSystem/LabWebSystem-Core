# タスク

## 目的
`package.json` の scripts を、役割起点で整理した階層構造へ再編する。

## 要件
- `tasks` は `launcher` へ改名する。
- コマンド群はコロン区切りで階層化する。
- `permissions:repair` は公開コマンドから除外する。
- `operations:reset:*` は廃止し、`operations:env_clean` に統合する。
- 環境クリーンは preview/apply 分割を廃止し、実行前に確認ダイアログを表示する。

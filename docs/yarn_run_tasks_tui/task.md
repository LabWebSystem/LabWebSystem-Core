# タスク

ルート `package.json` の既存 `scripts` は維持したまま、ターミナル上でインタラクティブにコマンドを選択・実行できる `yarn run tasks` を追加する。

## 完了条件

- 既存の `scripts` を削除・改名しない。
- `yarn run tasks` で TUI が起動し、`package.json` の script を一覧表示できる。
- 選択した script をそのまま実行できる。

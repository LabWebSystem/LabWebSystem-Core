# 修正内容の確認

## 1. 追加した機能

- `scripts/tasks/interactive-tasks.mjs` を新規作成。
- `yarn run tasks` で script ランチャーを起動できるようにした。

## 2. 実装の要点

- ルート `package.json` の `scripts` を動的に読み込み、選択肢として表示。
- ランチャー自身の `tasks` は再帰実行を避けるため選択肢から除外。
- 選択した script は `corepack yarn run <script名>` で実行。
- 実行終了後に続行確認を行い、複数コマンドを連続実行可能。
- TTY ではない環境では起動時に明示的なエラーメッセージを表示。

## 3. 変更ファイル

- `package.json`
- `scripts/tasks/interactive-tasks.mjs`
- `docs/yarn_run_tasks_tui/task.md`
- `docs/yarn_run_tasks_tui/implementation_plan.md`
- `docs/yarn_run_tasks_tui/walkthrough.md`

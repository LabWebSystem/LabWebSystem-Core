# 修正内容の確認

## 1. scripts の再編
- 旧コマンド群（`dev:*`, `lab:*`, `maintenance:*` など）を公開面から削除。
- 以下の新コマンド群へ統一。
  - `launcher`
  - `environment:dev:*`, `environment:lab:*`
  - `service:*`
  - `quality:*`
  - `operations:*`

## 2. ルートコマンドディスパッチ更新
- `scripts/dev/root-command.ts` のコマンドテーブルを新命名へ置換。
- 実行内容は既存ロジック（compose 起動停止、workspace dev、build、test、config）を再利用。
- `operations:env_clean` を `reset-lab-core.ts` 実行に接続。

## 3. launcher 名称反映
- `scripts/tasks/interactive-tasks.ts` の自己除外名を `launcher` に変更。
- 実行メッセージ・エラーメッセージのプレフィックスを `[launcher]` に統一。

## 4. env_clean の確認ダイアログ化
- `scripts/maintenance/reset-lab-core.ts` に `@inquirer/prompts` の `confirm` を導入。
- 既定動作:
  - まず削除対象プレビューを表示
  - 対話端末なら確認ダイアログを表示
  - `Yes` の場合のみクリーン実行
  - `No` の場合は中止
- 非対話環境はプレビューのみ表示し終了（実行には `--yes` が必要）。

## 5. 検証
- `./node_modules/.bin/tsc -p tsconfig.scripts.json` で型エラーがないことを確認。

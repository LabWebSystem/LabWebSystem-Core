# 修正内容の確認

## 1. `tasks` のツリーTUI化

- `scripts/tasks/interactive-tasks.ts` を新規実装。
- `package.json` の script 名を `:` で分割し、階層ツリーとして表示。
- グループノードは開閉可能。
- 操作キー:
  - `↑/↓`: 移動
  - `Enter`: グループ開閉 or コマンド実行
  - `←/→`: 折りたたみ / 展開
  - `Ctrl+C`: 終了

## 2. `.mjs` から `.ts` への移行

- `scripts` 配下の `.mjs` をすべて `.ts` へ置換。
- ルートランナーは `scripts/dev/root-command.ts` に移行し、内部実行も `runTsScript` 経由で `tsx` 実行へ変更。
- `scripts/testing/run_full_system_smoke_test.sh` も `corepack yarn tsx scripts/testing/full_system_smoke_test.ts` に更新。

## 3. 実行基盤の更新

- `package.json` の scripts を `corepack yarn tsx ...` へ統一。
- 開発依存として `tsx` / `typescript` / `@types/node` を追加。
- `tsconfig.scripts.json` を追加。
- `typecheck:scripts` (`corepack yarn tsc -p tsconfig.scripts.json`) を追加。

## 4. 検証結果

- `yarn run tasks` を TTY で起動し、階層表示と開閉動作を確認。
- `yarn run typecheck:scripts` 成功。
- `rg --files -g '*.mjs'` で `scripts` 配下の `.mjs` が残っていないことを確認。

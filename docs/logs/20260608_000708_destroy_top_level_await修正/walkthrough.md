# 修正内容の確認

`scripts/maintenance/reset-lab-core.ts` はファイル末尾で複数の `await` を直接実行しており、`tsx` がこのファイルを CJS 形式として変換したときに `Top-level await is currently not supported with the "cjs" output format` で失敗していた。

このため、環境ロードから preview 表示、確認ダイアログ、削除処理、完了表示までを `async main()` にまとめ、エントリポイントは `void main().catch(...)` に変更した。これで実行経路が ESM/CJS のどちら寄りでも `top-level await` に依存せず動く。

確認結果:

- `corepack yarn tsx scripts/maintenance/reset-lab-core.ts` : 成功
  - 非対話環境のため preview を表示し、`Re-run with --yes` で終了
- `corepack yarn tsx scripts/dev/root-command.ts destroy` : 成功
  - 同じく preview を表示し、変換エラーは再現しない
- `corepack yarn tsc -p tsconfig.scripts.json` : 成功

破壊的なため、今回は `--yes` を付けた実際の destroy 実行はしていない。

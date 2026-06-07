# 実装計画

1. `reset-lab-core.ts` の実行部を確認し、`tsx` の CJS 変換で落ちる `top-level await` 箇所を特定する
2. スクリプト全体の副作用実行を `async main()` に集約し、最後に `void main().catch(...)` で起動する形へ変更する
3. `corepack yarn tsx scripts/maintenance/reset-lab-core.ts` と `corepack yarn tsx scripts/dev/root-command.ts destroy` を実行し、変換エラーが消えてプレビュー表示まで進むことを確認する
4. `corepack yarn tsc -p tsconfig.scripts.json` で scripts 全体の型エラーがないことを確認する

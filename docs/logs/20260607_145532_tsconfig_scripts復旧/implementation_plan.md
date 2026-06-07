# 実装計画

作成日: 2026-06-07

## 方針
1. 現在の root `tsconfig.json` が scripts 向け設定として使えるか確認する。
2. `scripts/dev/root-command.ts` は `tsconfig.scripts.json` を参照しているため、コマンド側を大きく変えずに薄い橋渡し設定を追加する。
3. `yarn quality:typecheck:scripts` を実行して復旧確認する。

## 判断メモ
- 現時点の repo には `tsconfig.ts` は存在しない。
- `tsc` の標準導線としては `tsconfig.json` / `tsconfig.*.json` のほうが確実なので、今回は `tsconfig.scripts.json` を追加する。

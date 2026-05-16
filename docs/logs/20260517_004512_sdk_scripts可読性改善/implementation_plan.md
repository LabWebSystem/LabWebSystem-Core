# 実装計画

## 方針
- `workspaces foreach` で一行化すると root workspace を巻き込むため、SDK専用ランナーを追加して可読性と安全性を両立する。

## 実装手順
1. `sdk/scripts/workspace-runner.mjs` を追加
2. SDK対象 package の順序リストを定義
3. `sdk/package.json` scripts をランナー呼び出しへ置換
4. `yarn sdk:build` / `yarn sdk:test` を実行して確認

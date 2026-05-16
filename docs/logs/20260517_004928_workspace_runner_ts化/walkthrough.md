# 修正内容の確認

## 変更内容
1. `workspace-runner` の TS 化
- 追加: `sdk/scripts/workspace-runner.ts`
- 削除: `sdk/scripts/workspace-runner.mjs`

2. scripts の実行方式変更
- `sdk/package.json`
  - `build`: `tsx scripts/workspace-runner.ts build`
  - `test`: `tsx scripts/workspace-runner.ts test`
  - `clean`: `tsx scripts/workspace-runner.ts clean`

3. 依存追加
- `sdk/package.json` に `devDependencies: { "tsx": "^4.22.0" }` を追加

## 検証
- `yarn sdk:build`: 成功
- `yarn sdk:test`: 成功

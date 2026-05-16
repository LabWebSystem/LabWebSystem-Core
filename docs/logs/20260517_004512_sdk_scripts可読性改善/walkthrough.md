# 修正内容の確認

## 変更点
1. `sdk/package.json` の scripts を簡潔化
- 変更前: workspace コマンドを `&&` で長く連結
- 変更後: `node scripts/workspace-runner.mjs <action>` へ置換

2. SDK専用ランナーを追加
- `sdk/scripts/workspace-runner.mjs`
- 対象 workspace:
  - `@lab-core/sdk-contract`
  - `@lab-core/sdk-inspect`
  - `@lab-core/sdk-profile`
  - `@lab-core/sdk-seed`
  - `@lab-core/sdk-ci`
  - `@lab-core/sdk`
  - `@lab-core/sdk-cli`

## 検証結果
- `yarn sdk:build`: 成功
- `yarn sdk:test`: 成功

# 修正内容の確認

## 実施内容
1. 集約ライブラリ package 追加
- `sdk/packages/sdk` を追加し、以下 API を公開
  - `loadSdkContext`
  - `inspectSdk`
  - `lintSdk`
  - `guardProdSdk`
  - `exportSdkPayload`
  - `runSdkSeed`

2. GitHub 経由利用のための package 設定強化
- 各 package に `exports` を追加
- 各 package に `prepack` を追加（git 経由インストール時のビルド対応）

3. README 追記
- `sdk/README.md` に Yarn の Git workspace 依存形式での導入手順と Node.js 利用例を追記

4. モノレポ build/test 連携
- `sdk/package.json` の build/test/clean に `@lab-core/sdk` を追加

## 検証
- `yarn sdk:build` 成功
- `yarn sdk:test` 成功

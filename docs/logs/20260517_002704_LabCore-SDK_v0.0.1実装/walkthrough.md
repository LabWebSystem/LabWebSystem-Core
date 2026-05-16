# 修正内容の確認

## 実装結果
- `sdk/` 配下に `LabCore-SDK_v0.0.1` を実装した。
- 実装した package:
  - `@lab-core/sdk-contract`
  - `@lab-core/sdk-inspect`
  - `@lab-core/sdk-profile`
  - `@lab-core/sdk-seed`
  - `@lab-core/sdk-ci`
  - `@lab-core/sdk-cli`

## 主な機能
1. 契約定義
- `labcore.app.yaml` と profile YAML の schema 検証
- 登録用 payload schema

2. 解析・検証
- compose 解析（サービス・ポート・環境変数・デバイス候補）
- `lint`（service/compose/env/device 整合）
- `guard prod`（mock 混入・dev compose 混入・必須 env/デバイス欠落検知）

3. CLI
- `init`, `inspect`, `lint`, `preflight`, `seed`, `export`, `guard`, `doctor`, `ci-install`

4. CI テンプレート
- `.github/workflows/labcore-sdk.yml` の生成機能

## 追加・変更した主要ファイル
- `sdk/package.json`
- `sdk/tsconfig.base.json`
- `sdk/packages/**`（全パッケージ）
- `sdk/README.md`
- `sdk/docs/compatibility-matrix.md`
- `sdk/docs/migration-guide.md`
- `package.json`（workspace と SDK scripts 追加）

## 検証結果
- `yarn sdk:build`: 成功
- `yarn sdk:test`: 成功
- `yarn labcore help`: 成功
- スモーク:
  - 一時ディレクトリで `labcore init --template standard`
  - `labcore lint --profile dev-sim`
  - `labcore export --profile prod`
  - `labcore init --template device` + `inspect`

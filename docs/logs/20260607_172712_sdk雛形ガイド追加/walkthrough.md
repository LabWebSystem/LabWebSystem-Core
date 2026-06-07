# 確認結果: SDK雛形ガイド追加

## 実施内容
- `labcore init` の生成物に `labcore/SDK使い方.md` を追加した。
- 生成ドキュメントには以下を含めた。
  - 最初に確認するファイル
  - 初回セットアップの流れ
  - `labcore ...` と `yarn sdk:labcore ...` の両方のコマンド例
  - テンプレート初期値
  - 登録前チェック項目
- `sdk-cli` テストを追加し、`init` 実行後にガイドファイルが生成されることを検証した。
- `docs/readmes` の SDK 関連文書に、生成物として `labcore/SDK使い方.md` が含まれることを反映した。

## 変更ファイル
- `sdk/packages/sdk-cli/src/commands/init.ts`
- `sdk/packages/sdk-cli/tests/main.test.ts`
- `docs/readmes/SDK概要.md`
- `docs/readmes/SDK仕様書.md`
- `docs/readmes/適合アプリ作成ガイド.md`
- `docs/logs/20260607_172712_sdk雛形ガイド追加/task.md`
- `docs/logs/20260607_172712_sdk雛形ガイド追加/implementation_plan.md`
- `docs/logs/20260607_172712_sdk雛形ガイド追加/walkthrough.md`

## 確認結果
- `corepack yarn sdk:build`: 成功
- `corepack yarn sdk:test`: 成功
- `sdk-cli` の新規テストで `labcore/SDK使い方.md` の存在と主要文言を確認

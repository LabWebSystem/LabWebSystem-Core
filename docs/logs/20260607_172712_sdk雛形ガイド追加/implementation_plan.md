# 実装計画: SDK雛形ガイド追加

## 方針
- `sdk/packages/sdk-cli/src/commands/init.ts` に、テンプレート種別に応じた簡易ガイド Markdown を返す関数を追加する。
- 生成先は `labcore/SDK使い方.md` とし、既存の `profiles` / `seeds` と同じ初期化フローの一部として扱う。
- `sdk-cli` のテストを実体化し、`init` 実行後の生成物を直接検証する。
- `docs/readmes` の関連文書にも、雛形生成時に追加されるファイルとして追記する。

## 実装ステップ
1. `init.ts` に `sdkUsageGuideMd()` を追加する。
2. `runInitCommand()` から `labcore/SDK使い方.md` を生成する。
3. `sdk/packages/sdk-cli/tests/main.test.ts` を置き換え、生成ファイルと内容を検証する。
4. `docs/readmes/SDK概要.md` / `SDK仕様書.md` / `適合アプリ作成ガイド.md` を更新する。
5. `corepack yarn sdk:build` と `corepack yarn sdk:test` で確認する。

## 想定する生成文書の役割
- 雛形直後の最初の案内
- 必ず確認するファイルの一覧
- `lint` / `preflight` / `inspect` / `guard prod` / `export` の実行例
- テンプレート初期値の説明
- 実アプリ向けに更新すべき項目の明示

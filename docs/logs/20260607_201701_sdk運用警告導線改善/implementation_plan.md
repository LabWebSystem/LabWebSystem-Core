# 実装計画

作成日:
- 2026-06-07

## 1. SDK 検証強化
- `lintSdk` に運用警告の集約処理を追加する
- `doctor` と CLI `lint` が同じ警告結果を使うように揃える
- 警告対象:
  - 配備用 compose の `ports:`
  - runtime 設定や compose の `localhost`
  - same-origin ではない `VITE_API_BASE_URL`
  - `APPDATA_ROOT` 未使用
  - `prod` profile の `LABCORE_DEVICE_MODE` 未指定
  - `prod` profile への dev compose 混入
  - `hostname` の `*.lab.localhost` 残留

## 2. `init` 雛形改善
- `hostname` 既定値を `*.lab.localhost` へ変更する
- `docker-compose.dev.yml` に localhost 用 `ports:` を生成する
- `dev-real-device` も dev compose を使うよう修正する
- `prod` は配備用 compose のみを使うよう修正する
- `package.json` に `labcore:lint` などの repo ローカル scripts を生成する

## 3. 導入導線の安定化
- workspace 依存を持つ SDK パッケージの `prepack` を monorepo 全体 build へ変更する
- git 経由の pack 失敗を減らす

## 4. ドキュメント整備
- `適合アプリ作成ガイド.md` を運用寄りに更新する
- 構成図ドキュメントを追加する
- 登録前チェックリストを追加する
- `SDK概要.md` / `SDK仕様書.md` / `sdk/README.md` を新方針に合わせる

## 5. 検証
- `corepack yarn --cwd sdk build`
- `corepack yarn --cwd sdk test`
- `corepack yarn pack` を `sdk-cli` / `sdk` / `sdk-profile` で確認

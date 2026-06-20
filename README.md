# Lab-Core v3

研究室向け統合 Web アプリ配信・運用基盤のリポジトリです。

## 構成
- `core/backend`: Hono + TypeScript + SQLite の API サーバー
- `core/dashboard`: React + Vite の運用ダッシュボード
- `infra/compose`: backend / dashboard / proxy / DNS の compose 定義
- `scripts`: 起動・設定・品質確認・保守用スクリプト

## 前提依存関係
- Node.js: `22.x` 推奨
  - `2026-05-16` 時点で `Node 24` は `better-sqlite3` ビルド失敗を確認
- Yarn: `corepack yarn`（`packageManager: yarn@4.14.1`）
- Docker Engine
- Docker Compose v2（`docker compose`）
- Git

補足:
- 環境によっては `yarn install` 時に `make` / `gcc-c++` / `python3` が必要です。

## クイックスタート
1. `yarn install`
2. `yarn config:set`
3. 起動: `yarn system:up`
4. 必要に応じて `mock` / `local` / `lab` プロファイルを `yarn config:set` で選択
5. `http://dashboard.<LAB_CORE_ROOT_DOMAIN>/` を開く

## 公開コマンド（現行）
- ランチャー: `yarn launcher`
- 設定:
  - `yarn config:set`
  - `yarn config:show`
  - `yarn config:edit`
- 一括起動/停止/ログ（正規コマンド）:
  - `yarn system:up`
  - `yarn system:down`
  - `yarn system:logs`
- 旧コマンド（非推奨エイリアス）:
  - `yarn environment:dev:up`
  - `yarn environment:dev:down`
  - `yarn environment:dev:logs`
  - `yarn environment:lab:up`
  - `yarn environment:lab:down`
  - `yarn environment:lab:logs`
- 個別起動:
  - `yarn service:backend:up`
  - `yarn service:dashboard:up`
- 品質確認:
  - `yarn quality:build`
  - `yarn quality:typecheck:scripts`
  - `yarn quality:test:fixtures`
  - `yarn quality:test:smoke`
- 破壊的クリーンアップ（確認付き）:
  - `yarn destroy`

## 注意事項
- `.env` 再作成時はバックアップが自動作成されます。
- `config:set` のプロファイルは次の 3 つです。
  - `mock`: `dry-run` で proxy/DNS を localhost bind
  - `local`: `execute` で proxy/DNS を localhost bind
  - `lab`: `execute` で proxy/DNS を `0.0.0.0` bind

## ドキュメント
- docs 入口: `docs/README.md`
- 正式仕様（現行実装準拠）:
  - `docs/archives/20260516_230913_公式仕様統合/official_specification.md`
- 操作説明（簡易）:
  - `docs/readmes/Lab-Core運用手順書.md`
- backend OpenAPI 仕様:
  - `core/backend/openapi/openapi.yaml`
- 適合アプリ作成ガイド:
  - `docs/readmes/適合アプリ作成ガイド.md`
- SDK 概要:
  - `docs/readmes/SDK概要.md`
- SDK 仕様:
  - `docs/readmes/SDK仕様書.md`

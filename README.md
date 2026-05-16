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
2. `yarn config`
3. 開発: `yarn environment:dev:up`
4. 研究室運用: `yarn environment:lab:up`
5. `http://dashboard.<LAB_CORE_ROOT_DOMAIN>/` を開く

## 公開コマンド（現行）
- ランチャー: `yarn launcher`
- 設定: `yarn config`
- 一括起動/停止/ログ（開発）:
  - `yarn environment:dev:up`
  - `yarn environment:dev:down`
  - `yarn environment:dev:logs`
- 一括起動/停止/ログ（研究室運用）:
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
- `quality:test:smoke` は現状 `scripts/testing/run_full_system_smoke_test.sh` 内に旧コマンド参照が残っており、環境によっては修正が必要です。
- `.env` 再作成時はバックアップが自動作成されます。

## ドキュメント
- docs 入口: `docs/README.md`
- 正式仕様（現行実装準拠）:
  - `docs/20260516_230913_公式仕様統合/official_specification.md`
- 操作説明（簡易）:
  - `docs/readmes/how_to_use_lab_core.md`
- 適合アプリ作成ガイド:
  - `docs/lab_core_app_repository_guide/app_repository_creation_guide.md`

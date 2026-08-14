# Lab-Core Backend

## 実装済み範囲
- Hono ベース API サーバー
- 内蔵 DNS サーバー（generated hosts を参照）
- SQLite スキーマ初期化
- Application / Deployment / Route / Event / Operation モデル
- deploy / stop / resume / restart / rebuild / update-check / update / rollback / delete Operation
- `jobs` から `operations` への SQLite migration
- Operation Step / Operation Log / SSE 配信の基盤

## 主要 API
- `GET /health`
- `GET /api`
- `GET /api/openapi.json`
- `GET /api/openapi.yaml`
- `GET /api/system/status`
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:applicationId`
- `PATCH /api/applications/:applicationId`
- `GET /api/applications/:applicationId/deployment`
- `PATCH /api/applications/:applicationId/deployment`
- `GET /api/applications/:applicationId/deployment/inspection`
- `POST /api/applications/:applicationId/operations`
- `GET /api/applications/:applicationId/operations`
- `GET /api/operations/:operationId`
- `POST /api/operations/:operationId/cancel`
- `POST /api/operations/:operationId/retry`
- `GET /api/operations/:operationId/logs`
- `GET /api/operations/:operationId/logs/stream`
- `GET /api/applications/:applicationId/runtime-logs`
- `GET /api/events`
- `POST /api/infrastructure/sync`
- `POST /api/applications/import/resolve`
- `POST /api/applications/import/compose-inspect`
- `GET /api/testing/registration-fixtures`

## API Trace Map
- 旧操作 API と新 Operation API の対応表は `docs/readmes/バックエンドAPIトレースマップ.md` を参照
- `DELETE /api/applications/:applicationId` は正規 API から外し、`type: delete` の Operation に統一
- `/api/jobs` 系 API は廃止し、Operation 一覧/詳細/retry/cancel に置き換え

## OpenAPI 仕様
- 正本: `core/backend/openapi/openapi.yaml`
- 実行中 backend からも取得可能:
  - `GET /api/openapi.json`
  - `GET /api/openapi.yaml`
- 必要に応じて `LAB_CORE_OPENAPI_PATH` で読込先を上書き可能

## 実行モード
- `LAB_CORE_EXECUTION_MODE=dry-run`（既定）
- `LAB_CORE_EXECUTION_MODE=execute`
- `LAB_CORE_PROFILE=mock|local|lab`

## 既定パス（未設定時）
- `LAB_CORE_DB_PATH=./core/backend/data/database.sqlite`
- `LAB_CORE_APPS_ROOT=./runtime/apps`
- アプリ runtime layout: `runtime/apps/<application_id>/{src,data,.lab-core}`
- `LAB_CORE_APP_ROOT_DELETE_HELPER_PATH=./core/backend/scripts/delete-app-root.mjs`
- `LAB_CORE_APP_ROOT_DELETE_USE_SUDO=true`

## 生成ファイル
- `LAB_CORE_PROXY_CONFIG_PATH`（Caddy 設定）
- `LAB_CORE_DNS_HOSTS_PATH`（DNS hosts 形式）

## DNS サーバー
- `LAB_CORE_DNS_SERVER_ENABLED=true` で起動
- `LAB_CORE_DNS_BIND` を canonical な待受設定として使用
- `LAB_CORE_DNS_BIND_HOST`, `LAB_CORE_DNS_PORT` は移行互換として読込
- upstream は `LAB_CORE_DNS_UPSTREAMS` または `/etc/resolv.conf`
- 53番ポートは権限要件あり

## 開発コマンド（ルート実行）
1. `yarn install`
2. `yarn config:set`
3. backend 単体: `yarn service:backend:up`
4. 全体起動（推奨、dashboard / api は reverse proxy のドメイン経由）: `yarn system:up`

## migration / backup
- 既存 SQLite を更新する前に、`core/backend/data/database.sqlite` を退避してから backend を起動してください
- backend 起動時に `jobs` は `operations` へ冪等移行されます
- `queued` / `running` の旧未完了レコードは起動時に `interrupted` へ整理されます

## 保守
- 破壊的クリーンアップ:
  - `yarn destroy` / `yarn destroy:soft`
    - `.env` / DB / volume / backup / runtime app data を保持
    - Lab-Core とデプロイ済みアプリの container / network / generated artifact を削除
  - `yarn destroy:hard`
    - `.env` と Git worktree を保持
    - DB / volume / backup / runtime app data を含む Lab-Core 管理資産を削除
- 権限修復: `yarn permissions:repair`
  - 以前 root で作られた `core/backend/data/database.sqlite` や `runtime/` 配下を現在ユーザーへ戻す
  - `SqliteError: attempt to write a readonly database` が出たときの復旧に使う

## .env 読込
- backend 起動時に `core/backend/.env` を自動読込
- OS 環境変数が同名で存在する場合は OS 側を優先

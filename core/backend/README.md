# Lab-Core Backend

## 実装済み範囲
- Hono ベース API サーバー
- 内蔵 DNS サーバー（generated hosts を参照）
- SQLite スキーマ初期化
- Application / Deployment / Route / Event / Job モデル
- deploy / stop / resume / restart / rebuild / update / rollback / delete ジョブ

## 主要 API
- `GET /health`
- `GET /api`
- `GET /api/openapi.json`
- `GET /api/openapi.yaml`
- `GET /api/system/status`
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:applicationId`
- `PATCH /api/applications/:applicationId/deployment`
- `POST /api/applications/:applicationId/restart`
- `POST /api/applications/:applicationId/stop`
- `POST /api/applications/:applicationId/resume`
- `POST /api/applications/:applicationId/rebuild`
- `POST /api/applications/:applicationId/update-check`
- `POST /api/applications/:applicationId/update`
- `POST /api/applications/:applicationId/rollback`
- `DELETE /api/applications/:applicationId`
- `GET /api/jobs`
- `GET /api/events`
- `POST /api/infrastructure/sync`
- `GET /api/logs/:applicationId/services`
- `GET /api/logs/:applicationId?service=&tail=`
- `GET /api/testing/registration-fixtures`

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
- `LAB_CORE_APPDATA_ROOT=./runtime/appdata`

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
4. 全体起動（推奨）: `yarn system:up`

## 保守
- 破壊的クリーンアップ: `yarn destroy`
  - `.env` は保持
  - DB/生成物/runtime/Docker 管理資産を削除
- 権限修復: `yarn permissions:repair`
  - 以前 root で作られた `core/backend/data/database.sqlite` や `runtime/` 配下を現在ユーザーへ戻す
  - `SqliteError: attempt to write a readonly database` が出たときの復旧に使う

## .env 読込
- backend 起動時に `core/backend/.env` を自動読込
- OS 環境変数が同名で存在する場合は OS 側を優先

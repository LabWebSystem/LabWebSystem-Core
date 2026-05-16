# Lab-Core Backend

## 実装済み範囲
- Hono ベース API サーバー
- 内蔵 DNS サーバー（generated hosts を参照）
- SQLite スキーマ初期化
- Application / Deployment / Route / Event / Job モデル
- deploy / stop / resume / restart / rebuild / update / rollback / delete ジョブ

## 主要 API
- `GET /health`
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

## 実行モード
- `LAB_CORE_EXECUTION_MODE=dry-run`（既定）
- `LAB_CORE_EXECUTION_MODE=execute`

## 既定パス（未設定時）
- `LAB_CORE_DB_PATH=./core/backend/data/database.sqlite`
- `LAB_CORE_APPS_ROOT=./runtime/apps`
- `LAB_CORE_APPDATA_ROOT=./runtime/appdata`

## 生成ファイル
- `LAB_CORE_PROXY_CONFIG_PATH`（Caddy 設定）
- `LAB_CORE_DNS_HOSTS_PATH`（DNS hosts 形式）

## DNS サーバー
- `LAB_CORE_DNS_SERVER_ENABLED=true` で起動
- `LAB_CORE_DNS_BIND_HOST`, `LAB_CORE_DNS_PORT` で待受設定
- upstream は `LAB_CORE_DNS_UPSTREAMS` または `/etc/resolv.conf`
- 53番ポートは権限要件あり

## 開発コマンド（ルート実行）
1. `yarn install`
2. `yarn config`
3. backend 単体: `yarn service:backend:up`
4. 全体起動（推奨）: `yarn environment:dev:up`

## 保守
- 破壊的クリーンアップ: `yarn destroy`
  - `.env` は保持
  - DB/生成物/runtime/Docker 管理資産を削除

## .env 読込
- backend 起動時に `core/backend/.env` を自動読込
- OS 環境変数が同名で存在する場合は OS 側を優先
